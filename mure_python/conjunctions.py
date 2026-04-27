import re

class ConjunctionsHandler:
    def __init__(self):
        self.splitters = [" and ", " but ", " or ", " so "]
        
    def process(self, text: str):
        clauses = []
        conjunctions_found = []
        
        current_clause = text
        for splitter in self.splitters:
            if splitter in current_clause.lower():
                parts = re.split(splitter, current_clause, flags=re.IGNORECASE, maxsplit=1)
                if len(parts) == 2:
                    clauses.append(parts[0].strip())
                    current_clause = parts[1].strip()
                    conjunctions_found.append(splitter.strip())
                    
        if current_clause and clauses:
            clauses.append(current_clause)
            
        if not clauses:
            clauses = [text]
            
        return {
            "has_conjunctions": len(conjunctions_found) > 0,
            "clauses": clauses,
            "conjunctions": conjunctions_found
        }
