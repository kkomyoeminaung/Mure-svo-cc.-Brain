class DocumentIngestion:
    def __init__(self, mure_engine):
        self.mure_engine = mure_engine

    def extract_causal_rules_with_prd(self, text):
        import re
        patterns = [
            r"([A-Z][^.?!]*?) (?:causes|leads to|results in|triggers) ([^.?!]*?)[.?!]",
            r"Because of ([^.?!]*?), ([^.?!]*?)[.?!]",
            r"If ([^.?!]*?), then ([^.?!]*?)[.?!]",
        ]
        rules = []
        for pattern in patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                cause, effect = match.groups()
                if len(cause.strip()) > 5 and len(effect.strip()) > 5:
                    rules.append({
                        "cause": cause.strip(),
                        "effect": effect.strip(),
                        "confidence": 0.7,
                        "source": "document_ingestion"
                    })
        
        # If no rules found, use a slightly more aggressive split
        if not rules:
            for sentence in text.split('.'):
                if ' because ' in sentence:
                    parts = sentence.split(' because ')
                    rules.append({"cause": parts[1].strip(), "effect": parts[0].strip(), "confidence": 0.65, "source": "sentence_logic"})
        
        return rules if rules else [{"cause": "study", "effect": "knowledge", "confidence": 0.1, "source": "fallback"}]

    def ingest_file(self, file_path):
        with open(file_path, 'r') as f:
            text = f.read()
            rules = self.extract_causal_rules_with_prd(text)
            for rule in rules:
                self.mure_engine.add_rule(rule['cause'], rule['effect'], rule['confidence'], rule['source'])
