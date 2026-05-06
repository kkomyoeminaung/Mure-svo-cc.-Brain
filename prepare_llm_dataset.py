import json
import os
import random

def get_atomic_id_map(rules_list):
    # Simplistic mapping: assign ID to each unique text node
    unique_nodes = set()
    for rule in rules_list:
        unique_nodes.add(rule.get("cause"))
        unique_nodes.add(rule.get("effect"))
    
    node_to_id = {node: i for i, node in enumerate(unique_nodes)}
    return node_to_id

def prepare_llm_dataset(memory_dir="data/brain", output_prefix="mure_dataset"):
    """
    Converts MURE's causal memory chunks into an Instruction Tuning dataset 
    and a structured graph training dataset.
    """
    dataset = []
    
    # Check if directory exists
    if not os.path.exists(memory_dir):
        print(f"Directory {memory_dir} not found, falling back to local files.")
        memory_dir = "."

    # 1. Read all causal memory chunks
    source_files = [f for f in os.listdir(memory_dir) if (f.startswith("causal_memory_") and f.endswith(".json")) or f == "rules.json"]
    
    all_rules = []
    for file in source_files:
        filepath = os.path.join(memory_dir, file)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                rules_list = data.get('causalMemory', []) if isinstance(data, dict) else data
                all_rules.extend(rules_list)
        except: continue
        
    if not all_rules:
        print("No rules found. Dataset will be empty.")
        return

    node_to_id = get_atomic_id_map(all_rules)
    
    # 2. Build structured data
    for rule in all_rules:
        cause = rule.get("cause", "")
        effect = rule.get("effect", "")
        
        if not cause or not effect: continue

        # Structured representation (mapping cause/effect to Atomic ID structure)
        # Using [S, V, O, C, E] where S=0, V=0, O=0, C=CauseID, E=EffectID
        atomic_ids = [0, 0, 0, node_to_id[cause], node_to_id[effect]]

        # Text prompt templates
        templates = [
            (f"What is the effect of: '{cause}'?", f"'{cause}' causes '{effect}'."),
            (f"'{cause}' ဖြစ်ရင် ဘာဖြစ်မလဲ?", f"'{cause}' ကြောင့် '{effect}' ဖြစ်ပေါ်လာနိုင်ပါတယ်။")
        ]
        instruction, output = random.choice(templates)
        # Slightly better: simple character encoding with a shift to avoid control chars
        # Plus padding to max_len=20
        tokenized = [0] # SOS token
        for c in output:
            tokenized.append((ord(c) + 1) % 50257) # Shift by 1 to differentiate from padding 0
        
        # Consistent padding to exactly 128 (increased from 20 to avoid truncation)
        tokenized_output = (tokenized + [0]*128)[:128]
        
        dataset.append({
            "instruction": instruction,
            "input": "",
            "output": output,
            "tokenized_output": tokenized_output,
            "atomic_ids": atomic_ids
        })
                
    # 3. Shuffle and Split
    random.shuffle(dataset)
    split_idx = int(len(dataset) * 0.9)
    train_data = dataset[:split_idx]
    val_data = dataset[split_idx:]
    
    def save_jsonl(data, filename):
        with open(filename, 'w', encoding='utf-8') as f:
            for item in data:
                f.write(json.dumps(item) + '\n')
    
    save_jsonl(train_data, f"{output_prefix}_train.jsonl")
    save_jsonl(val_data, f"{output_prefix}_val.jsonl")
    
    # Save node mapping for trainer
    with open("node_mapping.json", "w", encoding='utf-8') as f:
        json.dump(node_to_id, f)
            
    print(f"✅ Dataset saved: Train({len(train_data)}), Val({len(val_data)}), Map({len(node_to_id)})")

if __name__ == "__main__":
    prepare_llm_dataset("data/brain", "mure_finetune_dataset")
