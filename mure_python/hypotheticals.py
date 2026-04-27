class HypotheticalsHandler:
    def __init__(self):
        self.markers = ["what if", "suppose", "imagine", "assume", "hypothetically"]
        
    def process(self, text: str):
        text_lower = text.lower()
        is_hypo = False
        
        for m in self.markers:
            if m in text_lower:
                is_hypo = True
                break
                
        return {
            "is_hypothetical": is_hypo
        }
