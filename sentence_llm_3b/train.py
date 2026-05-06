import torch
import torch.nn as nn
import torch.optim as optim
import json
import os
from sentence_llm_3b.models.graph_network import CompleteSentenceLLM
from sentence_llm_3b.config import training_cfg, model_cfg
from torch.utils.data import DataLoader, TensorDataset

def load_data(jsonl_file):
    atomic_ids = []
    labels = []
    if not os.path.exists(jsonl_file):
        print(f"Data file {jsonl_file} not found. Generate it first.")
        # Create dummy data for compilation/test consistency if needed
        return torch.zeros((1, 5), dtype=torch.long), torch.zeros((1, 20), dtype=torch.long)

    with open(jsonl_file, 'r', encoding='utf-8') as f:
        for line in f:
            item = json.loads(line)
            # Ensure atomic_ids are 5D [S, V, O, C, E]
            atomic_ids.append(item['atomic_ids'])
            # Ensure tokens are [max_tokens]
            labels.append(item['tokenized_output'])
    return torch.tensor(atomic_ids, dtype=torch.long), torch.tensor(labels, dtype=torch.long)

def train():
    # Load data
    dataset_file = "mure_finetune_dataset_train.jsonl"
    atomic_ids, labels = load_data(dataset_file)
    num_sentences = atomic_ids.size(0)
    
    # Placeholder: Assuming causal graph nodes and vocab size from mapping
    mapping_file = "node_mapping.json"
    if os.path.exists(mapping_file):
        with open(mapping_file, "r") as f:
            node_map = json.load(f)
        num_nodes = len(node_map)
    else:
        num_nodes = 1000 # Fallback

    # Simplified model initialization
    model = CompleteSentenceLLM(
        num_subjects=1, num_verbs=1, num_objects=1, 
        num_causes=num_nodes, num_effects=num_nodes, 
        num_sentences=num_sentences, num_chains=1
    ).to(training_cfg.device)
    
    optimizer = optim.AdamW(model.parameters(), lr=model_cfg.learning_rate)

    dataloader = DataLoader(TensorDataset(atomic_ids, labels), batch_size=model_cfg.batch_size, shuffle=True)

    model.train()
    for epoch in range(model_cfg.max_epochs):
        epoch_loss = 0
        for batch_atomic_ids, batch_labels in dataloader:
            batch_atomic_ids = batch_atomic_ids.to(training_cfg.device)
            batch_labels = batch_labels.to(training_cfg.device)
            
            optimizer.zero_grad()
            loss, logits = model(batch_atomic_ids, batch_labels)
            
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            epoch_loss += loss.item()
            
        print(f"Epoch {epoch} finished. Avg Loss: {epoch_loss / len(dataloader)}")

if __name__ == "__main__":
    train()
