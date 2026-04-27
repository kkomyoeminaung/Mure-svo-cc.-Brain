"""
Level 1: Atomic Node Encoder
"""
import torch
import torch.nn as nn
import torch.nn.functional as F

class AtomicNodeEncoder(nn.Module):
    def __init__(self, num_subjects, num_verbs, num_objects, num_causes, num_effects, embed_dim=256):
        super().__init__()
        self.embed_dim = embed_dim
        self.subject_embed = nn.Embedding(max(1, num_subjects), embed_dim)
        self.verb_embed = nn.Embedding(max(1, num_verbs), embed_dim)
        self.object_embed = nn.Embedding(max(1, num_objects), embed_dim)
        self.cause_embed = nn.Embedding(max(1, num_causes), embed_dim)
        self.effect_embed = nn.Embedding(max(1, num_effects), embed_dim)
        
        self.role_attention = nn.MultiheadAttention(embed_dim, num_heads=4)
        self.output_proj = nn.Linear(embed_dim, embed_dim)

    def forward(self, subject_ids, verb_ids, object_ids, cause_ids, effect_ids):
        subject_emb = self.subject_embed(subject_ids)
        verb_emb = self.verb_embed(verb_ids)
        object_emb = self.object_embed(object_ids)
        cause_emb = self.cause_embed(cause_ids)
        effect_emb = self.effect_embed(effect_ids)
        
        role_stack = torch.stack([subject_emb, verb_emb, object_emb, cause_emb, effect_emb], dim=1)
        role_stack = role_stack.transpose(0, 1)
        attn_out, _ = self.role_attention(role_stack, role_stack, role_stack)
        attn_out = attn_out.transpose(0, 1)
        
        role_weights = F.softmax(attn_out.mean(dim=-1), dim=-1)
        combined = (attn_out * role_weights.unsqueeze(-1)).sum(dim=1)
        return self.output_proj(combined)
        
    def forward_single_role(self, role: str, ids: torch.Tensor) -> torch.Tensor:
        if role == 'subject': return self.subject_embed(ids)
        elif role == 'verb': return self.verb_embed(ids)
        elif role == 'object': return self.object_embed(ids)
        elif role == 'cause': return self.cause_embed(ids)
        elif role == 'effect': return self.effect_embed(ids)
        raise ValueError(f"Unknown role: {role}")
