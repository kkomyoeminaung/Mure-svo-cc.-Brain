class EmbeddedClausesHandler:
    def __init__(self):
        self.markers = ["think that", "know that", "believe that", "fact that", "say that", "said that", "means that"]
        
    def process(self, text: str):
        text_lower = text.lower()
        
        for marker in self.markers:
            if marker in text_lower:
                idx = text_lower.find(marker) + len(marker)
                main_clause = text[idx:].strip()
                prefix = text[:idx].strip()
                return {
                    "has_embedded": True,
                    "prefix": prefix,
                    "main_clause": main_clause
                }
                
        return {"has_embedded": False}
