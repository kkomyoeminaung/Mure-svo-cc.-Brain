class IntentionalityHandler:
    def __init__(self):
        self.verbs = ["want", "need", "try", "plan", "intend", "desire", "hope"]
        
    def process(self, text: str):
        text_lower = text.lower()
        words = text_lower.split()
        intent = None
        
        for v in self.verbs:
            if v in words:
                intent = v
                break
                
        return {
            "is_intentional": intent is not None,
            "intent_verb": intent
        }
