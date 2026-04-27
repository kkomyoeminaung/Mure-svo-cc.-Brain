import re

class ComparativesHandler:
    def __init__(self):
        self.comparators = ["more", "less", "better", "worse", "stronger", "weaker", "than"]
        
    def process(self, text: str):
        text_lower = text.lower()
        if " than " in text_lower:
            parts = re.split(r'\s+than\s+', text, flags=re.IGNORECASE)
            if len(parts) == 2:
                left = parts[0].strip()
                right = parts[1].strip()
                
                comparator = None
                words = left.split()
                for c in ["more", "less", "better", "worse", "stronger", "weaker"]:
                    if c in text_lower:
                        comparator = c
                        break
                elif any(w.endswith("er") for w in words):
                    for w in words:
                        if w.endswith("er") and w not in ["other", "another"]:
                            comparator = w
                            break
                            
                return {
                    "is_comparative": True,
                    "entity1": left.replace(comparator, "").replace(" is ", "").strip() if comparator else left,
                    "entity2": right,
                    "comparator": comparator
                }
        return {"is_comparative": False}
