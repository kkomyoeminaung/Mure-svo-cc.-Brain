"""
Configuration for Sentence-based LLM 3B
"""

import os
import torch
from dataclasses import dataclass

@dataclass
class ModelConfig:
    """Model architecture configuration"""
    # Embedding dimensions
    atomic_embed_dim: int = 256      # Level 1
    sentence_embed_dim: int = 768    # Level 2
    chain_embed_dim: int = 1024      # Level 3
    
    # Number of nodes
    num_atomic_nodes: int = 500000   # Subject, Verb, Object, Cause, Effect
    num_sentence_nodes: int = 2000000  # 2M sentences from priming data
    num_chain_nodes: int = 100000    # Causal chains
    
    # Transformer layers
    num_encoder_layers: int = 12
    num_decoder_layers: int = 12
    num_attention_heads: int = 12
    
    # Training
    batch_size: int = 32
    learning_rate: float = 1e-4
    warmup_steps: int = 1000
    max_epochs: int = 50
    gradient_clip: float = 1.0


@dataclass
class DataConfig:
    """Data configuration"""
    rules_path: str = "data/brain/rules.json"
    data_dir: str = "./data"
    cache_dir: str = "./cache"
    max_rules: int = 2000000  # 2 million rules
    max_sentence_length: int = 50  # words per sentence
    train_ratio: float = 0.8
    val_ratio: float = 0.1
    test_ratio: float = 0.1


@dataclass
class TrainingConfig:
    """Training configuration"""
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    num_workers: int = 4
    checkpoint_dir: str = "./checkpoints"
    log_dir: str = "./logs"
    save_every: int = 1000
    eval_every: int = 500
    use_amp: bool = True  # Automatic mixed precision


# Create configs
model_cfg = ModelConfig()
data_cfg = DataConfig()
training_cfg = TrainingConfig()


def get_model_size():
    """Calculate model size in billions of parameters (approximate)"""
    atomic_params = model_cfg.atomic_embed_dim * model_cfg.num_atomic_nodes
    sentence_params = model_cfg.sentence_embed_dim * model_cfg.num_sentence_nodes
    chain_params = model_cfg.chain_embed_dim * model_cfg.num_chain_nodes
    
    # Transformer parameters approximation: 12 * layers * d_model^2
    d = model_cfg.sentence_embed_dim
    layers = model_cfg.num_encoder_layers + model_cfg.num_decoder_layers
    transformer_params = layers * (12 * d * d)
    
    total = atomic_params + sentence_params + chain_params + transformer_params
    return total / 1e9

if __name__ == "__main__":
    print(f"📊 Estimated model size: {get_model_size():.2f}B parameters")
