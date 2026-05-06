import numpy as np
from typing import List, Dict, Tuple
from .config import config

class MUREGuardrail:
    """Protects the brain from data poisoning and logical contradictions"""
    
    @staticmethod
    def is_valid_rule(cause: str, effect: str) -> bool:
        if not cause or not effect: return False
        if len(cause) < 2 or len(effect) < 2: return False
        if cause.lower() == effect.lower(): return False
        return True

    @staticmethod
    def is_safe(text: str) -> bool:
        """Basic content safety check"""
        if not text or len(text.strip()) < 2:
            return False
        # Harmful content keywords (extend as needed)
        harmful = ["harm", "kill", "destroy", "weapon", "exploit", "terror", "attack"]
        text_lower = text.lower()
        if any(h in text_lower for h in harmful):
            return False
        return True

    @staticmethod
    def detect_contradiction(new_rule: Dict, existing_rules: List[Dict]) -> Tuple[bool, str]:
        """Checks if a new rule contradicts existing knowledge"""
        for rule in existing_rules:
            if rule['cause'].lower() == new_rule['cause'].lower():
                if rule['effect'].lower() != new_rule['effect'].lower():
                    # If existing rule is much stronger, flag contradiction
                    if rule['strength'] > new_rule['strength'] + 0.2:
                        return True, f"Contradicts established fact: {rule['effect']}"
        return False, ""

    @staticmethod
    def calculate_cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        dot_product = np.dot(vec_a, vec_b)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        return dot_product / (norm_a * norm_b) if norm_a > 0 and norm_b > 0 else 0.0

    @staticmethod
    def is_duplicate_semantically(new_embedding: np.ndarray, 
                                 existing_embeddings: List[np.ndarray], 
                                 threshold: float = config.DEDUPLICATION_THRESHOLD) -> bool:
        for emb in existing_embeddings:
            if MUREGuardrail.calculate_cosine_similarity(new_embedding, emb) > threshold:
                return True
        return False
