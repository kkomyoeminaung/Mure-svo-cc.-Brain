import re

class NegationHandler:
    def __init__(self):
        self.negation_words = {"not", "no", "never", "n't", "neither", "hardly", "barely", "without"}
        
    def detect_negation(self, text: str) -> bool:
        words = text.lower().split()
        return any(nw in words or any(w.endswith("n't") for w in words) for nw in self.negation_words)
    
    def process(self, text: str):
        is_negated = self.detect_negation(text)
        return is_negated
