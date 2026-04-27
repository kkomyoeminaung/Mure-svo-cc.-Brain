class CounterfactualsHandler:
    def process(self, text: str):
        text_lower = text.lower()
        is_cf = False
        
        if "if" in text_lower and ("had" in text_lower or "would have" in text_lower or "would be" in text_lower):
            is_cf = True
        elif "even if" in text_lower:
            is_cf = True
        elif "had it not" in text_lower:
            is_cf = True
            
        return {
            "is_counterfactual": is_cf
        }
