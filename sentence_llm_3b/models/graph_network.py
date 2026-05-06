"""
Complete Graph Network
"""
import torch
import torch.nn as nn
from .atomic_encoder import AtomicNodeEncoder

class CompleteSentenceLLM(nn.Module):
    def __init__(self, num_subjects, num_verbs, num_objects, num_causes, num_effects, num_sentences, num_chains, vocab_size=50257, max_len=20):
        super().__init__()
        self.atomic_encoder = AtomicNodeEncoder(
            num_subjects, num_verbs, num_objects, num_causes, num_effects, embed_dim=256
        )
        self.sentence_embed_dim = 768
        self.vocab_size = vocab_size
        self.max_len = max_len
        
        # Generative head for token level decoding
        self.sentence_proj = nn.Linear(256, 768)
        self.token_embedding = nn.Embedding(vocab_size, 768)
        
        # Use a small GRU as a decoder to actually handle sequences
        self.decoder_rnn = nn.GRU(768, 768, batch_first=True)
        self.token_decoder = nn.Linear(768, vocab_size)
    
    def forward(self, atomic_ids: torch.Tensor, labels: torch.Tensor = None):
        """
        Calculates loss or logits.
        atomic_ids: [batch, 5]
        labels: [batch, max_tokens] (optional)
        """
        batch_size = atomic_ids.shape[0]
        # Get graph embeddings
        graph_h = self.atomic_encoder(*[atomic_ids[:, i] for i in range(5)]) # S, V, O, C, E
        initial_h = self.sentence_proj(graph_h).unsqueeze(0) # [1, batch, 768] (for GRU)
        
        if labels is not None:
            # Training mode: Teacher Forcing
            # labels is [batch, max_len]
            # input to RNN: [batch, max_len, 768]
            
            # Predict the whole sequence using Teacher Forcing
            # input is labels[:, :-1], target is labels[:, 1:]
            inputs = self.token_embedding(labels[:, :-1]) # [batch, max_len-1, 768]
            
            rnn_out, _ = self.decoder_rnn(inputs, initial_h) # [batch, max_len-1, 768]
            logits = self.token_decoder(rnn_out) # [batch, max_len-1, vocab_size]
            
            import torch.nn.functional as F
            # Target is labels[:, 1:]
            loss = F.cross_entropy(logits.reshape(-1, self.vocab_size), labels[:, 1:].reshape(-1))
            return loss, logits
        
        # Inference/Eval mode (predicting first token context)
        dummy_input = torch.zeros(batch_size, 1, dtype=torch.long).to(atomic_ids.device)
        token_emb = self.token_embedding(dummy_input)
        rnn_out, _ = self.decoder_rnn(token_emb, initial_h)
        logits = self.token_decoder(rnn_out.squeeze(1))
        return logits

    def generate(self, atomic_ids: torch.Tensor, max_tokens: int = 20) -> torch.Tensor:
        """
        Actually map atomic graph nodes to sequence of tokens using autoregressive decoding.
        """
        batch_size = atomic_ids.shape[0]
        device = atomic_ids.device
        
        # Get graph embeddings
        graph_h = self.atomic_encoder(*[atomic_ids[:, i] for i in range(5)])
        current_h = self.sentence_proj(graph_h).unsqueeze(0) # [1, batch, 768]
        
        # Start with a dummy input (e.g. token 0 or a special <SOS> if we had one)
        # Using 0 as a placeholder for start token
        last_token = torch.zeros(batch_size, 1, dtype=torch.long).to(device)
        tokens = []
        
        hidden = current_h
        for _ in range(max_tokens):
            token_emb = self.token_embedding(last_token) # [batch, 1, 768]
            rnn_out, hidden = self.decoder_rnn(token_emb, hidden) # [batch, 1, 768]
            logits = self.token_decoder(rnn_out.squeeze(1)) # [batch, vocab_size]
            
            next_token = torch.argmax(logits, dim=-1, keepdim=True) # [batch, 1]
            tokens.append(next_token)
            last_token = next_token
            
        return torch.cat(tokens, dim=1)
