import re

class PossessivesHandler:
    def __init__(self):
        pass
        
    def process(self, text: str):
        possessives = []
        
        s_matches = re.finditer(r'([a-zA-Z]+)\'s\s+([a-zA-Z]+)', text)
        for match in s_matches:
            possessives.append({
                "owner": match.group(1),
                "owned": match.group(2)
            })
            
        of_matches = re.finditer(r'(the\s+)?([a-zA-Z]+)\s+of\s+([a-zA-Z]+)', text, re.IGNORECASE)
        for match in of_matches:
            possessives.append({
                "owner": match.group(3),
                "owned": match.group(2)
            })
            
        return {"has_possessive": len(possessives) > 0, "pairs": possessives}
