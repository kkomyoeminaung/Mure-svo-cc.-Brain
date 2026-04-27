class QuantifierHandler:
    def __init__(self):
        self.quantifiers = {
            "all": 1.0, "every": 1.0,
            "most": 0.8, "majority": 0.8,
            "some": 0.4, "a few": 0.3, "several": 0.5,
            "no": 0.0, "none": 0.0
        }
        
    def process(self, text: str):
        text_lower = text.lower()
        words = text_lower.split()
        q_val = None
        
        for q, v in self.quantifiers.items():
            if q in words:
                q_val = v
                break
                
        return {
            "has_quantifier": q_val is not None,
            "strength": q_val
        }
