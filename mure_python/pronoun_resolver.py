class PronounResolver:
    def __init__(self):
        self.pronouns = {"it", "he", "she", "they", "this", "that"}
        
    def process(self, text: str, context: dict = None):
        out_text = text
        words = text.split()
        resolved = {}
        
        if context and context.get('subject'):
            for i, w in enumerate(words):
                if w.lower() in self.pronouns:
                    resolved[w] = context['subject']
                    words[i] = context['subject']
                    
            out_text = " ".join(words)
            
        return {"resolved_text": out_text, "resolutions": resolved}
