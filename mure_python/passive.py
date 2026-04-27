import re

class PassiveHandler:
    def __init__(self):
        self.be_verbs = {"is", "am", "are", "was", "were", "be", "being", "been"}
        
    def process(self, text: str):
        words = text.split()
        if "by" in words:
            by_idx = words.index("by")
            has_be = False
            for bev in self.be_verbs:
                if bev in words[:by_idx]:
                    has_be = True
                    break
                    
            if has_be and by_idx < len(words) - 1:
                subject = " ".join(words[by_idx + 1:])
                verb = words[by_idx - 1]
                object_phrase = " ".join(words[:by_idx - 1])
                obj_words = object_phrase.split()
                obj_clean = [w for w in obj_words if w.lower() not in self.be_verbs]
                
                return {
                    "is_passive": True,
                    "active_form": f"{subject} {verb} {' '.join(obj_clean)}",
                    "subject": subject,
                    "verb": verb,
                    "object": " ".join(obj_clean)
                }
        return {"is_passive": False}
