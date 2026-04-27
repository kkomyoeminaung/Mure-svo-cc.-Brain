import json
import os
import random

def prepare_llm_dataset(memory_dir="data/brain", output_file="mure_llm_dataset.jsonl"):
    """
    Converts MURE's causal memory chunks into an Instruction Tuning dataset 
    for Fine-Tuning a 3B/8B LLM (like Gemma-2b or Phi-3).
    """
    dataset = []
    
    # 1. Read all causal memory chunks
    for file in os.listdir(memory_dir):
        if file.startswith("causal_memory_") and file.endswith(".json"):
            print(f"Processing {file}...")
            filepath = os.path.join(memory_dir, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    chunk = json.load(f)
                    
                    for rule in chunk:
                        cause = rule.get("cause", "")
                        effect = rule.get("effect", "")
                        strength = rule.get("strength", 0)
                        
                        if not cause or not effect:
                            continue
                            
                        # Generate different variations of prompts for better learning
                        prompt_type = random.choice([1, 2, 3])
                        
                        if prompt_type == 1:
                            instruction = f"What is the effect of: '{cause}'?"
                            output = f"Based on MURE logical reasoning, '{cause}' causes '{effect}' (Confidence: {strength})."
                        elif prompt_type == 2:
                            instruction = f"Identify the causal relationship between '{cause}' and '{effect}'."
                            if strength > 0.8:
                                output = f"There is a strong causal relationship: '{cause}' leads to '{effect}'."
                            else:
                                output = f"There is a moderate/weak causal relationship: '{cause}' may lead to '{effect}'."
                        else:
                            instruction = f"If '{cause}' happens, what will logically follow?"
                            output = f"Logically, this will result in '{effect}'."
                            
                        dataset.append({
                            "instruction": instruction,
                            "input": "",
                            "output": output
                        })
            except Exception as e:
                print(f"Error reading {file}: {e}")

    # 2. Save as JSONL (Format expected by HuggingFace datasets)
    print(f"Total pairs generated: {len(dataset)}")
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in dataset:
            f.write(json.dumps(item) + '\n')
            
    print(f"✅ LLM Fine-tuning dataset saved to {output_file}")
    print("You can now upload this file to Google Colab and use Unsloth/HuggingFace to fine-tune Gemma-2b or Phi-3!")

if __name__ == "__main__":
    prepare_llm_dataset(".", "mure_finetune_dataset.jsonl")
