import re

class TenseHandler:
    def __init__(self):
        self.past_markers = {"ed", "was", "were", "had", "did", "yesterday", "ago", "last"}
        self.future_markers = {"will", "shall", "going to", "tomorrow", "next"}
        self.irregular_past = {"went", "saw", "came", "made", "took", "gave", "found", "told", "became", "brought", "kept", "held"}
        
    def process(self, text: str) -> str:
        words = text.lower().split()
        
        if any(fm in text.lower() for fm in self.future_markers):
            return "future"
            
        past_indicators = [w for w in words if w.endswith("ed") or w in self.past_markers or w in self.irregular_past]
        if past_indicators:
            return "past"
            
        return "present"
