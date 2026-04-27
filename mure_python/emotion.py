class EmotionHandler:
    def __init__(self):
        self.emotions = {
            "happy": "positive", "love": "positive", "glad": "positive", "joy": "positive",
            "sad": "negative", "hate": "negative", "angry": "negative", "mad": "negative", "fear": "negative"
        }
        
    def process(self, text: str):
        text_lower = text.lower()
        words = text_lower.split()
        emotion = None
        polarity = None
        
        for e, p in self.emotions.items():
            if e in words:
                emotion = e
                polarity = p
                break
                
        return {
            "has_emotion": emotion is not None,
            "emotion": emotion,
            "polarity": polarity
        }
