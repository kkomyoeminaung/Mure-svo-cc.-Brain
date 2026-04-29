import os
os.environ["HF_HUB_DISABLE_AUTHENTICATION"] = "1"
from google.colab import drive
import os
from IPython.display import display, Javascript

drive.mount('/content/drive')

BASE_DIR = "/content/drive/MyDrive/svo cc brain"
os.makedirs(BASE_DIR, exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "checkpoints"), exist_ok=True)

# Keep-Alive Script
display(Javascript('''
    function ClickConnect() {
        console.log("✅ Keep-alive: Clicking Connect button...");
        document.querySelector("colab-connect-button").click()
    }
    setInterval(ClickConnect, 60000)
'''))

print(f"✅ Workspace: {BASE_DIR}")

import os
import json
import time
import requests
import jsonlines
import subprocess
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor

RULES_FILE = os.path.join(BASE_DIR, 'rules_gemma_hq.jsonl')
# Adjusting target to a realistic high-quality extraction volume using Local LLM
TARGET_COUNT = 100_000 

print("🚀 Starting local Ollama server...")
subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(3)

print("📥 Pulling Gemma-2-2B locally (No HuggingFace Account required)...")
os.system("ollama pull gemma2:2b")

print("📚 Downloading raw text corpus for extraction...")
if not os.path.exists('corpus.txt'):
    os.system("wget -qO corpus.txt https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt") # Using a stable raw text file to avoid chunk errors

with open('corpus.txt', 'r') as f:
    text_data = f.read()

# Split text into bite-sized chunks for LLM processing
chunks = [text_data[i:i+800] for i in range(0, len(text_data), 800)]

rules = []
seen_keys = set()

if os.path.exists(RULES_FILE):
    with jsonlines.open(RULES_FILE) as reader:
        for obj in reader:
            rules.append(obj)
            seen_keys.add((obj.get('cause'), obj.get('effect')))

def extract_with_gemma(chunk):
    """ Uses Ollama local API with strict JSON formatting """
    prompt = f"\"\"Extract cause-and-effect rules. Output ONLY a valid JSON array of objects with 'cause' and 'effect' keys.\nText: {chunk}\"\"
    try:
        res = requests.post('http://localhost:11434/api/generate', 
                            json={"model": "gemma2:2b", "prompt": prompt, "stream": False, "format": "json"}, timeout=15)
        return json.loads(res.json()['response'])
    except:
        return []

if len(rules) < TARGET_COUNT:
    print(f"🧠 Generating High-Quality Rules using Local Gemma (Concurrent Processing)...")
    pbar = tqdm(total=TARGET_COUNT, initial=len(rules))
    writer = jsonlines.open(RULES_FILE, mode='a')
    
    # Use Multi-threading for SPEED
    with ThreadPoolExecutor(max_workers=4) as executor:
        for result in executor.map(extract_with_gemma, chunks):
            if isinstance(result, list):
                for rule in result:
                    if 'cause' in rule and 'effect' in rule:
                        key = (rule['cause'], rule['effect'])
                        if key not in seen_keys:
                            seen_keys.add(key)
                            rules.append(rule)
                            writer.write(rule)
                            pbar.update(1)
            if len(rules) >= TARGET_COUNT:
                break
                
    writer.close()
    print("\n✅ High Quality Gemma Extraction Complete!")
else:
    print("✅ Dataset already complete!")

import torch.nn.functional as F
from torch.optim import AdamW
from torch.utils.data import Dataset, DataLoader

class DistillationTrainer:
    def __init__(self, t, s, base_path):
        self.teacher = t
        self.student = s
        self.checkpoint_dir = os.path.join(base_path, "checkpoints")
        self.opt = AdamW(self.student.parameters(), lr=4e-5)
        self.step = 0
        self._load_resume()

    def _load_resume(self):
        path = os.path.join(self.checkpoint_dir, "latest_distill.pt")
        if os.path.exists(path):
            ckpt = torch.load(path, map_location='cpu')
            self.student.load_state_dict(ckpt['model'])
            self.student.to("cuda")
            self.opt.load_state_dict(ckpt['opt'])
            self.step = ckpt['step']
            print(f"✅ Resumed distillation from Step {self.step}")
        
        # Initialize scheduler
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(self.opt, T_max=1000000, eta_min=1e-6)
        if os.path.exists(path) and 'scheduler' in ckpt:
            self.scheduler.load_state_dict(ckpt['scheduler'])

    def save(self):
        path = os.path.join(self.checkpoint_dir, "latest_distill.pt")
        ckpt = {
            'model': self.student.state_dict(), 
            'opt': self.opt.state_dict(), 
            'scheduler': self.scheduler.state_dict(),
            'step': self.step
        }
        torch.save(ckpt, path)
        if self.step % 5000 == 0:
            torch.save(self.student.state_dict(), os.path.join(self.checkpoint_dir, f"mure_3b_s{self.step}.pt"))

    def train(self, loader):
        self.teacher.eval()
        self.student.train()
        GRAD_ACCUM = 4
        pbar = tqdm(total=len(loader), initial=self.step % len(loader))
        
        for i, (input_ids, mask) in enumerate(loader):
            # Simple skip logic for resume (approximation with shuffle)
            if self.step > 0 and i < (self.step % len(loader)):
                if i % 100 == 0: pbar.update(100)
                continue
            
            ids, mask = input_ids.to("cuda"), mask.to("cuda")
            with torch.no_grad(): 
                t_logits = self.teacher(ids, attention_mask=mask).logits
            
            s_logits = self.student(ids, attention_mask=mask).logits
            
            # Reshape for multidimensional KL loss
            batch, seq, vocab = s_logits.shape
            s_log_prob = F.log_softmax(s_logits.reshape(-1, vocab) / 2.0, dim=-1)
            t_prob = F.softmax(t_logits.reshape(-1, vocab) / 2.0, dim=-1)
            
            loss = F.kl_div(s_log_prob, t_prob, reduction='batchmean') * 4.0
            loss = loss / GRAD_ACCUM
            loss.backward()
            
            if (i + 1) % GRAD_ACCUM == 0:
                self.opt.step()
                self.scheduler.step()
                self.opt.zero_grad()
            
            self.step += 1
            if self.step % 10 == 0:
                loss_val = loss.item()*GRAD_ACCUM
                pbar.set_description(f"Loss: {loss_val:.4f}")
                with open(os.path.join(self.checkpoint_dir, 'training_log.txt'), 'a') as f:
                    f.write(f'Step {self.step}: {loss_val:.4f}\n')
            if self.step % 500 == 0: self.save()
            pbar.update(1)
        self.save() # Final save

class RuleDataset(Dataset):
    def __init__(self, path, tk):
        print("📖 Mapping 5M rules (Virtual Mapping via HuggingFace Datasets for Efficiency)...")
        try:
            from datasets import load_dataset
            self.data = load_dataset('json', data_files=path, split='train')
            self.data = self.data.filter(lambda x: x is not None)
        except Exception as e:
            print(f"❌ Failed to load rules: {e}")
            self.data = []
        self.tk = tk
    def __len__(self): return len(self.data)
    def __getitem__(self, i):
        try:
            rule = self.data[i]
            t = f"Cause: {rule.get('cause', '?')} -> Effect: {rule.get('effect', '?')}"
            e = self.tk(t, truncation=True, padding='max_length', max_length=128, return_tensors='pt')
            return e['input_ids'].squeeze(), e['attention_mask'].squeeze()
        except Exception:
            # Fallback for errors
            import torch
            return torch.zeros(128, dtype=torch.long), torch.zeros(128, dtype=torch.long)

loader = DataLoader(RuleDataset(RULES_FILE, tokenizer), batch_size=8, shuffle=True)
trainer = DistillationTrainer(teacher, student, BASE_DIR)
trainer.train(loader)
torch.save(student.state_dict(), os.path.join(BASE_DIR, "mure_final_3b_weights.pt"))
tokenizer.save_pretrained(os.path.join(BASE_DIR, "tokenizer"))
print("🏆 Distillation Complete. MURE Brain is ready for deployment.")
