import re

class ConditionalsHandler:
    def __init__(self):
        self.conditional_words = ["if", "when", "unless", "provided that", "as long as"]
        
    def process(self, text: str):
        text_lower = text.lower()
        condition = None
        result = None
        is_conditional = False
        
        for cw in self.conditional_words:
            if text_lower.startswith(cw + " "):
                is_conditional = True
                parts = text.split(",", 1)
                if len(parts) == 2:
                    condition = parts[0][len(cw):].strip()
                    result = parts[1].strip()
                elif " then " in text_lower:
                    parts = re.split(r'\s+then\s+', text, flags=re.IGNORECASE)
                    if len(parts) == 2:
                        condition = parts[0][len(cw):].strip()
                        result = parts[1].strip()
                break
            elif " " + cw + " " in text_lower:
                is_conditional = True
                parts = re.split(rf'\s+{cw}\s+', text, flags=re.IGNORECASE)
                if len(parts) == 2:
                    result = parts[0].strip()
                    condition = parts[1].strip()
                break
                
        return {"is_conditional": is_conditional, "condition": condition, "result": result}
