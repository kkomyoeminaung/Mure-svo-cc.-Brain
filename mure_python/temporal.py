class TemporalHandler:
    def __init__(self):
        self.markers = ["before", "after", "during", "while", "when", "then", "finally"]
        
    def process(self, text: str):
        text_lower = text.lower()
        words = text_lower.split()
        temporal_info = {}
        
        for m in self.markers:
            if m in words:
                temporal_info['marker'] = m
                break
                
        return {
            "has_temporal": len(temporal_info) > 0,
            "info": temporal_info
        }
