import os
import json
import random
from tqdm import tqdm
try:
    from vllm import LLM, SamplingParams
except ImportError:
    print("❌ vLLM not found. Run: !pip install vllm")
    exit()

# Configuration
MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct" # Small but smart enough for rules
TARGET_COUNT = 5_000_000
BATCH_SIZE = 5000 # vLLM thrives on large batches
OUTPUT_FILE = "/content/drive/MyDrive/svo cc brain/vllm_rules_5m.jsonl"

def generate_prompts(count):
    seeds = [
        "If the temperature rises", "When a user clicks a button",
        "Because of heavy rain", "Due to high inflation",
        "If a processor overheats", "When energy prices drop",
        "After a code deployment", "If the firewall is breached"
    ]
    prompts = []
    for _ in range(count):
        seed = random.choice(seeds)
        prompts.append(f"Instruction: Generate a single logical causal rule.\nCause: {seed}\nEffect:")
    return prompts

def run_generation():
    print(f"🚀 Initializing vLLM with {MODEL_ID}...")
    llm = LLM(model=MODEL_ID, tensor_parallel_size=1) # Adjust if multiple GPUs
    sampling_params = SamplingParams(temperature=0.7, top_p=0.9, max_tokens=32)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    current_count = 0
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "rb") as f:
            for _ in f: current_count += 1
    
    print(f"📊 Resuming from {current_count:,} rules...")
    pbar = tqdm(total=TARGET_COUNT, initial=current_count)

    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        while current_count < TARGET_COUNT:
            batch_prompts = generate_prompts(BATCH_SIZE)
            outputs = llm.generate(batch_prompts, sampling_params)
            
            for i, output in enumerate(outputs):
                cause = batch_prompts[i].split("Cause: ")[1].split("\n")[0]
                effect = output.outputs[0].text.strip()
                
                rule = {
                    "cause": cause,
                    "effect": effect,
                    "strength": round(random.uniform(0.7, 0.99), 2),
                    "source": "vllm_generator"
                }
                f.write(json.dumps(rule) + "\n")
            
            current_count += BATCH_SIZE
            pbar.update(BATCH_SIZE)

if __name__ == "__main__":
    run_generation()
