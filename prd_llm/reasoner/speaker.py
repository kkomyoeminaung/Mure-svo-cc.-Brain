import random

class MURESpeaker:
    def __init__(self):
        # Causality templates
        self.causal_templates = [
            "{cause} leads to {effect}.",
            "When {cause}, {effect} happens.",
            "{effect} is caused by {cause}.",
            "Due to {cause}, {effect} occurs.",
            "{cause} results in {effect}.",
            # Myanmar
            "{cause} ကြောင့် {effect} ဖြစ်တယ်။",
            "{cause} ရင် {effect} တယ်။",
        ]
        
        # Conversation templates
        self.conversation = {
            "greeting": ["မင်္ဂလာပါ။ မေးလို့ရပါတယ်။", "ဟိုင်း။ ကျွန်တော် MURE ပါ။"],
            "how_are_you": ["ကျွန်တော် ကောင်းပါတယ်။", "ဒေတာတွေ လေ့လာနေတယ်။"],
            "name": ["ကျွန်တော့်နာမည် MURE ပါ။ Causal Reasoning AI ပါ။"],
            "thanks": ["ရပါတယ်။", "ဂုဏ်ယူပါတယ်။"],
            "goodbye": ["သွားတော့မယ်။ နောက်မှပြန်ဆုံမယ်။", "ဘိုင်။"]
        }
    
    def detect_intent(self, text):
        text_lower = text.lower()
        if any(w in text_lower for w in ["မင်္ဂလာ", "ဟိုင်း", "hello"]):
            return "greeting"
        if any(w in text_lower for w in ["နေကောင်း", "how are"]):
            return "how_are_you"
        if any(w in text_lower for w in ["နာမည်", "name", "who are"]):
            return "name"
        if any(w in text_lower for w in ["ကျေးဇူး", "thank"]):
            return "thanks"
        if any(w in text_lower for w in ["သွားတော့", "goodbye", "bye"]):
            return "goodbye"
        if any(w in text_lower for w in ["ဘာလို့", "ဘာဖြစ်", "causes", "why", "what"]):
            return "causal"
        return "unknown"
    
    def speak_causal(self, cause, effect, confidence):
        template = random.choice(self.causal_templates)
        sentence = template.format(cause=cause, effect=effect)
        
        # Add confidence
        if confidence > 0.8:
            sentence += " သေချာပါတယ်။"
        elif confidence > 0.6:
            sentence += " ဖြစ်နိုင်ခြေများပါတယ်။"
        
        return sentence
    
    def speak(self, text, cause=None, effect=None, confidence=0):
        intent = self.detect_intent(text)
        
        if intent == "causal" and cause and effect:
            return self.speak_causal(cause, effect, confidence)
        elif intent in self.conversation:
            return random.choice(self.conversation[intent])
        else:
            return "ကျွန်တော် နားမလည်သေးဘူး။ 'ဘာလို့' 'ဘာဖြစ်' နဲ့ မေးပါ။"
