class SpatialHandler:
    def __init__(self):
        self.markers = ["in", "on", "under", "above", "below", "inside", "outside", "from", "to", "into"]
        
    def process(self, text: str):
        text_lower = text.lower()
        words = text_lower.split()
        spatial_info = []
        
        for i, w in enumerate(words):
            if w in self.markers:
                context_words = words[i+1:i+4]
                spatial_info.append({
                    "marker": w, 
                    "context": " ".join(context_words)
                })
                
        return {
            "has_spatial": len(spatial_info) > 0,
            "info": spatial_info
        }
