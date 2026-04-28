import torch
import numpy as np
from sentence_transformers import SentenceTransformer
from rapidfuzz import process, fuzz
from typing import List, Dict, Tuple, Optional
from .config import config
from .sqlite_storage import SQLiteStorage
from .guardrail import MUREGuardrail

class MUREEngine:
    """The Hybrid Fuzzy + Semantic Neural-Symbolic Brain"""
    def __init__(self, storage: SQLiteStorage):
        self.storage = storage
        print(f"🧠 Loading Neural Model: {config.EMBEDDING_MODEL}...")
        self.model = SentenceTransformer(config.EMBEDDING_MODEL, device=config.DEVICE)
        self.guardrail = MUREGuardrail()
        
        # Cache for performance
        self.rules_cache: List[Dict] = []
        self.embeddings_cache: Optional[np.ndarray] = None
        self.refresh_cache()

    def refresh_cache(self):
        """Loads rules into RAM for fast search"""
        self.rules_cache = self.storage.get_all_rules()
        if self.rules_cache:
            texts = [r['cause'] for r in self.rules_cache]
            self.embeddings_cache = self.model.encode(texts, convert_to_numpy=True)
        else:
            self.embeddings_cache = None
        self.embeddings_cache = self.embeddings_cache # Type hinting help

    def hybrid_search(self, query: str, top_k: int = 5) -> List[Tuple[Dict, float]]:
        if not self.rules_cache:
            return []

        query = query.lower().strip()
        
        # 1. Fuzzy Scoring (RapidFuzz)
        causes = [r['cause'] for r in self.rules_cache]
        fuzzy_results = process.extract(query, causes, scorer=fuzz.token_set_ratio, limit=top_k*2)
        fuzzy_map = {res[0]: res[1] / 100.0 for res in fuzzy_results}

        # 2. Semantic Scoring (Sentence-BERT)
        query_emb = self.model.encode([query], convert_to_numpy=True)[0]
        
        semantic_scores = []
        if self.embeddings_cache is not None:
            # Vectorized cosine similarity
            # Ensure embeddings_cache is double precision if needed or matches query_emb
            similarities = np.dot(self.embeddings_cache, query_emb) / (
                np.linalg.norm(self.embeddings_cache, axis=1) * np.linalg.norm(query_emb) + 1e-9
            )
            semantic_scores = similarities

        # 3. Hybrid Fusion
        combined_results = []
        for i, rule in enumerate(self.rules_cache):
            f_score = fuzzy_map.get(rule['cause'], 0.0)
            s_score = semantic_scores[i] if i < len(semantic_scores) else 0.0
            
            # Weighted confidence
            confidence = (f_score * config.HYBRID_FUZZY_WEIGHT) + (s_score * config.HYBRID_SEMANTIC_WEIGHT)
            
            if confidence > config.SEMANTIC_THRESHOLD:
                combined_results.append((rule, confidence))

        # Sort by confidence
        combined_results.sort(key=lambda x: x[1], reverse=True)
        return combined_results[:top_k]

    def reason(self, query: str) -> Dict:
        # BUG-AGI-03 Fix: Add guardrail check
        if hasattr(self, 'guardrail') and not self.guardrail.is_safe(query):
            return {
                "success": False,
                "reason": "Content flagged by guardrail.",
                "confidence": 0.0
            }

        matches = self.hybrid_search(query)
        
        if not matches:
            return {
                "success": False,
                "reason": "No causal link found in brain.",
                "confidence": 0.0
            }
            
        best_match, score = matches[0]
        return {
            "success": True,
            "cause": best_match['cause'],
            "effect": best_match['effect'],
            "confidence": score,
            "source": best_match['source'],
            "all_matches": [{"effect": m[0]['effect'], "score": m[1]} for m in matches[1:3]]
        }
