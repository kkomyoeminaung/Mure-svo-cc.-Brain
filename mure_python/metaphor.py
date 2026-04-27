import json
import os

class MetaphorHandler:
    def __init__(self, idioms_path: str = "mure_python/idioms.json"):
        self.idioms = {
            "raining cats and dogs": "raining heavily",
            "when it rains, it pours": "one bad thing leads to more",
            "make hay while the sun shines": "take opportunity",
            "every cloud has a silver lining": "good from bad"
        }
        try:
            if os.path.exists(idioms_path):
                with open(idioms_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.idioms.update(data)
        except Exception:
            pass
            
    def process(self, text: str):
        text_lower = text.lower()
        
        for idiom, literal in self.idioms.items():
            if idiom in text_lower:
                return {
                    "has_idiom": True,
                    "idiom": idiom,
                    "literal_meaning": literal,
                    "resolved_text": text.replace(idiom, literal)
                }
                
        return {
            "has_idiom": False,
            "resolved_text": text
        }
