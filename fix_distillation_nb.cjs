const fs = require("fs");
const path = "distillation_notebook.ipynb";
const nb = JSON.parse(fs.readFileSync(path, "utf8"));

// 1. Fix KL Loss & GradScaler in Cell 5 (Index 5 in 'cells' list, based on view_file output)
// Wait, let me check the cell indices.
// 0: Markdown
// 1: setup_drive
// 2: install_deps
// 3: gen_logic
// 4: load_models
// 5: distill_engine (This is the one!)

nb.cells[5].source = [
  "# 5. Knowledge Distillation Engine (High-Performance KL-D)\n",
  "import os, torch, json\n",
  "import torch.nn.functional as F\n",
  "from torch.utils.data import DataLoader, Dataset\n",
  "from tqdm.auto import tqdm\n",
  "\n",
  "class HighSpeedDataset(Dataset):\n",
  "    def __init__(self, path, tk, limit=500000):\n",
  "        self.examples = []\n",
  "        if os.path.exists(path):\n",
  "            with open(path, \"r\") as f:\n",
  "                for i, line in enumerate(f):\n",
  "                    if i >= limit: break\n",
  "                    item = json.loads(line)\n",
  "                    self.examples.append(f\"Cause: {item[\\\"cause\\\"]} -> Effect: {item[\\\"effect\\\"]}\")\n",
  "        self.tk = tk\n",
  "    def __len__(self): return len(self.examples)\n",
  "    def __getitem__(self, i):\n",
  "        return self.tk(self.examples[i], truncation=True, padding=\\\"max_length\\\", max_length=128, return_tensors=\\\"pt\\\")\n",
  "\n",
  "loader = DataLoader(HighSpeedDataset(RULES_FILE, tokenizer), batch_size=8, shuffle=True)\n",
  "opt = torch.optim.AdamW(student.parameters(), lr=3e-5)\n",
  "scaler = torch.cuda.amp.GradScaler()\n",
  "\n",
  "for batch in tqdm(loader, desc=\"Distilling Knowledge (KL-Loss)\"):\n",
  "    ids = batch['input_ids'].squeeze(1).cuda()\n",
  "    \n",
  "    with torch.cuda.amp.autocast():\n",
  "        with torch.no_grad(): t_logits = teacher(ids).logits\n",
  "        s_logits = student(ids).logits\n",
  "        \n",
  "        B, T, V = s_logits.size()\n",
  "        vm = min(s_logits.size(-1), t_logits.size(-1))\n",
  "        \n",
  "        s_flat = F.log_softmax(s_logits[..., :vm].reshape(-1, vm) / 2.0, dim=-1)\n",
  "        t_flat = F.softmax(t_logits[..., :vm].reshape(-1, vm) / 2.0, dim=-1)\n",
  "        \n",
  "        loss = F.kl_div(s_flat, t_flat, reduction=\"batchmean\") * 4.0\n",
  "    \n",
  "    if torch.cuda.is_bf16_supported():\n",
  "        loss.backward(); opt.step(); opt.zero_grad()\n",
  "    else:\n",
  "        scaler.scale(loss).backward(); scaler.step(opt); scaler.update(); opt.zero_grad()\n"
];

// 2. Fix DPO in Cell 6 (Index 6)
nb.cells[6].source = [
  "# 6. DPO Alignment (Direct Preference Optimization)\n",
  "print(\"⚖️ Starting DPO Alignment...\")\n",
  "from trl import DPOConfig, DPOTrainer\n",
  "from datasets import Dataset as HFDataset\n",
  "from peft import LoraConfig, get_peft_model\n",
  "\n",
  "lora_cfg = LoraConfig(r=16, lora_alpha=32, target_modules=[\"q_proj\",\"k_proj\",\"v_proj\",\"o_proj\"], lora_dropout=0.05, bias=\"none\", task_type=\"CAUSAL_LM\")\n",
  "student_dpo = get_peft_model(student, lora_cfg)\n",
  "\n",
  "# Load preference data properly\n",
  "dpo_ds = load_dataset(\"json\", data_files=os.path.join(BASE_DIR, \"rules.json\"), split=\"train\") # Need to format this as DPO!\n",
  "\n",
  "dpo_trainer = DPOTrainer(\n",
  "    model=student_dpo, ref_model=None,\n",
  "    args=DPOConfig(output_dir=os.path.join(BASE_DIR, \"dpo_checkpoints\"), num_train_epochs=1, per_device_train_batch_size=1, gradient_accumulation_steps=4), \n",
  "    train_dataset=dpo_ds,\n",
  "    tokenizer=tokenizer,\n",
  ")\n",
  "\n",
  "dpo_trainer.train()\n"
];

fs.writeFileSync(path, JSON.stringify(nb, null, 1));
