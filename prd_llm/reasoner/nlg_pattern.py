import random
from typing import Dict, List, Optional

# Adjusted import to map to the project structure
from prd_llm.reasoner.mure_engine import MUREEngine as MUREReasoner

class PatternNLG:
    """
    Pattern-based Natural Language Generator for MURE
    - No LLM, no API, no internet
    - 100% rule-based, 100% explainable
    - Generates fluent, varied responses from patterns
    """
    
    def __init__(self):
        # ============================================
        # 1. Causal Pattern Templates (အဓိက)
        # ============================================
        self.causal_patterns = {
            # English patterns
            "en": {
                "direct": [
                    "{cause} causes {effect}.",
                    "{cause} leads to {effect}.",
                    "{cause} results in {effect}.",
                ],
                "when": [
                    "When {cause}, {effect} happens.",
                    "When {cause}, it causes {effect}.",
                ],
                "reason": [
                    "{effect} is caused by {cause}.",
                    "{effect} happens because of {cause}.",
                ]
            },
            # Myanmar patterns
            "my": {
                "direct": [
                    "{cause} က {effect} ကိုဖြစ်စေတယ်။",
                    "{cause} ကြောင့် {effect} ဖြစ်တယ်။",
                ],
                "when": [
                    "{cause} ဖြစ်ရင် {effect} ဖြစ်တယ်။",
                    "{cause} တဲ့အခါ {effect} တယ်။",
                ],
                "reason": [
                    "{effect} ဖြစ်တာက {cause} ကြောင့်ပါ။",
                ]
            }
        }
        
        # ============================================
        # 2. Conversation Patterns
        # ============================================
        self.conversation_patterns = {
            "greeting": ["မင်္ဂလာပါ။ မေးလို့ရပါတယ်။", "ဟိုင်း။ ကျွန်တော် MURE ပါ။", "Hello! How can I help you today?"],
            "how_are_you": ["ကျွန်တော် ကောင်းပါတယ်။", "I'm doing well, thank you for asking!"],
            "name": ["ကျွန်တော့်နာမည် MURE ပါ။", "I'm MURE, a causal reasoning AI."],
            "thanks": ["ရပါတယ်။", "You're welcome!"],
            "goodbye": ["သွားတော့မယ်။ နောက်မှပြန်ဆုံမယ်။", "Goodbye!"],
            "unknown": ["ကျွန်တော် နားမလည်သေးဘူး။", "I'm not sure I understand."]
        }
    
    def detect_language(self, text: str) -> str:
        for char in text:
            if '\u1000' <= char <= '\u109F':
                return "my"
        return "en"
    
    def detect_intent(self, text: str) -> str:
        text_lower = text.lower()
        
        intents = {
            "greeting": ["hello", "hi", "မင်္ဂလာ", "ဟိုင်း"],
            "how_are_you": ["how are", "နေကောင်း"],
            "name": ["your name", "who are", "နာမည်"],
            "thanks": ["thank", "ကျေးဇူး"],
            "goodbye": ["bye", "သွားတော့"],
        }
        
        for intent, keywords in intents.items():
            if any(kw in text_lower for kw in keywords):
                return intent
        
        if any(p in text_lower for p in ["cause", "why", "ဘာလို့", "ဘာဖြစ်"]):
            return "causal"
        
        return "unknown"
    
    def generate_causal(self, cause: str, effect: str, confidence: float, language: str = "en") -> str:
        patterns = self.causal_patterns[language]
        pattern = random.choice(patterns["direct"])
        
        # Add qualifier
        sentence = pattern.format(cause=cause, effect=effect)
        if language == "en":
              if confidence > 0.8: sentence = "Definitely, " + sentence.lower()
        else:
              if confidence > 0.8: sentence = sentence + " သေချာပါတယ်။"
        return sentence

    def generate_response(self, user_input: str, cause: Optional[str] = None, effect: Optional[str] = None, confidence: float = 0.5) -> str:
        language = self.detect_language(user_input)
        intent = self.detect_intent(user_input)
        
        if intent in self.conversation_patterns:
            return random.choice(self.conversation_patterns[intent])
        
        if (intent == "causal" or (cause and effect)):
            if cause and effect:
                return self.generate_causal(cause, effect, confidence, language)
            else:
                return random.choice(self.conversation_patterns["unknown"])
        
        return random.choice(self.conversation_patterns["unknown"])
