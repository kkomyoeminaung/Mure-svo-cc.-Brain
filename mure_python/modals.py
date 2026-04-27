import re

class ModalsHandler:
    def __init__(self):
        self.modals = {
            "might": 0.4, "may": 0.5, "could": 0.5,
            "can": 0.6, "cannot": 0.0, "can't": 0.0,
            "should": 0.7, "would": 0.7, "ought to": 0.7,
            "must": 0.95, "will": 0.9, "shall": 0.85
        }
        
    def process(self, text: str) -> float:
        strength = None
        words = text.lower().split()
        for modal, value in self.modals.items():
            if modal in words or (modal == "ought to" and "ought to" in text.lower()):
                if strength is None or value > strength:
                    strength = value
        return strength
