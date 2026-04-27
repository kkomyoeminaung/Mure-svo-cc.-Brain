class CertaintyHandler:
    def __init__(self):
        self.adverbs = {
            "definitely": 1.0, "certainly": 0.95, "absolutely": 1.0,
            "probably": 0.8, "likely": 0.75,
            "possibly": 0.5, "maybe": 0.4, "perhaps": 0.4,
            "unlikely": 0.2
        }
        
    def process(self, text: str):
        text_lower = text.lower()
        words = text_lower.split()
        cert_val = None
        
        for a, v in self.adverbs.items():
            if a in words:
                cert_val = v
                break
                
        return {
            "has_certainty": cert_val is not None,
            "strength": cert_val
        }
