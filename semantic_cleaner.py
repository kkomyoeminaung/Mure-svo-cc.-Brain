import json
import torch
import argparse
from sentence_transformers import SentenceTransformer, util
from tqdm.auto import tqdm

def clean_dataset(input_file, output_file, text_key_en, text_key_my, threshold=0.5):
    print("Loading Multilingual Semantic Model (paraphrase-multilingual-MiniLM-L12-v2)...")
    # We use MiniLM because it's fast and supports 50+ languages, including Myanmar.
    # Alternatively, 'sentence-transformers/LaBSE' provides better accuracy for bilingual text but is heavier.
    model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
    
    if torch.cuda.is_available():
        model = model.to('cuda')
        print("Using GPU for fast similarity calculation.")

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading {input_file}: {e}")
        return

    print(f"Loaded {len(lines)} records. Starting semantic validation...")
    
    clean_records = []
    removed_records = []
    
    for line in tqdm(lines, desc="Checking Semantic Similarity"):
        try:
            data = json.loads(line)
            
            en_text = data.get(text_key_en, "")
            my_text = data.get(text_key_my, "")
            
            # If the specific keys are not found, keep the record as is (it might be a different format)
            if not en_text or not my_text:
                clean_records.append(data)
                continue
            
            # 1. Compute text embeddings
            en_emb = model.encode(en_text, convert_to_tensor=True)
            my_emb = model.encode(my_text, convert_to_tensor=True)
            
            # 2. Compute Cosine Similarity between English and Myanmar embeddings
            similarity = util.cos_sim(en_emb, my_emb).item()
            
            # 3. Filtering Logic
            if similarity >= threshold:
                data['semantic_similarity'] = round(similarity, 4)
                clean_records.append(data)
            else:
                data['semantic_similarity'] = round(similarity, 4)
                removed_records.append(data)
                
        except json.JSONDecodeError:
            continue
            
    print(f"Validation complete.")
    print(f"✅ Kept {len(clean_records)} high-quality records.")
    print(f"🗑️ Removed {len(removed_records)} low-quality / mismatched records (Semantic Score < {threshold}).")
    
    # Save clean dataset
    print(f"Saving clean records to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        for rec in clean_records:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')
            
    # Optionally save removed records for manual inspection
    bad_file = output_file.replace(".jsonl", "_removed.jsonl")
    if len(removed_records) > 0 and bad_file != output_file:
        with open(bad_file, 'w', encoding='utf-8') as f:
            for rec in removed_records:
                f.write(json.dumps(rec, ensure_ascii=False) + '\n')
        print(f"Saved removed records for inspection at {bad_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Filter bilingual dataset based on Semantic Similarity")
    parser.add_argument('--input', type=str, required=True, help="Input JSONL file")
    parser.add_argument('--output', type=str, required=True, help="Output JSONL file")
    parser.add_argument('--en_key', type=str, default="english", help="Key for English text in JSON")
    parser.add_argument('--my_key', type=str, default="myanmar", help="Key for Myanmar text in JSON")
    parser.add_argument('--threshold', type=float, default=0.5, help="Cosine similarity threshold (0 to 1). Higher = stricter.")
    
    args = parser.parse_args()
    clean_dataset(args.input, args.output, args.en_key, args.my_key, args.threshold)
