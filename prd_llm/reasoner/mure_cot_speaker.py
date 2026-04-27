import json
import random
from typing import Dict, List, Optional, Tuple
from prd_llm.reasoner.mure_engine import MUREEngine

class MURECoT:
    """
    MURE with Chain of Thought reasoning and Natural Language output
    - Thinks in SVO-CC (internally)
    - Speaks in Natural Language (externally)
    """
    
    def __init__(self, rules_path: str = None):
        # Load MURE's causal rules (15M)
        self.reasoner = MUREEngine(rules_path)
        
        # Translation templates (SVO-CC → Natural Language)
        self.translation_layer = SVOCCTranslator()
    
    # ============================================
    # PHASE 1: Internal Thinking (SVO-CC)
    # ============================================
    def think(self, user_input: str) -> Dict:
        """
        Internal reasoning in SVO-CC format
        User doesn't see this
        """
        # Get causal rule from MURE
        result = self.reasoner.reason(user_input)
        
        # Build SVO-CC thought structure
        thought = {
            "subject": result.get('cause', 'unknown'),
            "verb": "causes",
            "object": result.get('effect', 'unknown'),
            "cause": result.get('cause', 'unknown'),
            "effect": result.get('effect', 'unknown'),
            "confidence": result.get('confidence', 0.5),
            "chain": self.get_causal_chain(result.get('cause', '')),
            "question_type": self.detect_question_type(user_input)
        }
        
        return thought
    
    def get_causal_chain(self, start: str, max_depth: int = 3) -> List[str]:
        """Get causal chain A → B → C → D"""
        chain = []
        # get_causal_chain in MUREEngine returns a list of tuples (cause, effect, confidence)
        raw_chain = self.reasoner.get_causal_chain(start, max_depth)
        for _, effect, _ in raw_chain:
            chain.append(effect)
        return chain
    
    def detect_question_type(self, text: str) -> str:
        text_lower = text.lower()
        if text_lower.startswith('what'):
            return "what"
        if text_lower.startswith('why'):
            return "why"
        if text_lower.startswith('how'):
            return "how"
        if 'should' in text_lower:
            return "advice"
        return "general"
    
    # ============================================
    # PHASE 2: Translation Layer (SVO-CC → Natural Language)
    # ============================================
    def speak(self, thought: Dict) -> str:
        """
        Convert SVO-CC thought to natural language
        This is the KEY missing piece
        """
        return self.translation_layer.translate(thought)
    
    # ============================================
    # PHASE 3: Complete Response
    # ============================================
    def respond(self, user_input: str) -> str:
        """Complete pipeline: Think → Translate → Respond"""
        # Step 1: Think (internal)
        thought = self.think(user_input)
        
        # Step 2: Translate (SVO-CC → Natural Language)
        response = self.speak(thought)
        
        return response


class SVOCCTranslator:
    """
    Translation Layer: Converts SVO-CC internal thoughts to natural language
    No LLM needed. Pattern-based, fast, explainable.
    """
    
    def __init__(self):
        self.templates = {
            # Causal patterns
            "direct_cause": [
                "{cause} causes {effect}.",
                "{cause} leads to {effect}.",
                "Because of {cause}, {effect} occurs.",
                "{effect} results as a consequence of {cause}.",
            ],
            "when_cause": [
                "When {cause}, {effect} frequently happens.",
                "Whenever {cause} occurs, {effect} follows.",
                "In cases where {cause}, we observe {effect}.",
            ],
            "chain": [
                "{cause} leads to {mid}, which subsequently results in {effect}.",
                "First {cause} occurs, triggering {mid}, and finally leading to {effect}.",
            ],
            # Question type specific
            "what_response": [
                "{cause} is the primary driver of {effect}.",
                "The relationship is direct: {cause} → {effect}.",
            ],
            "why_response": [
                "This occurs because {cause} invariably causes {effect}.",
                "The underlying reason is that {cause} triggers {effect}.",
            ],
            "how_response": [
                "{cause} initiates a sequence that produces {effect}.",
                "It works by {cause}, which ultimately generates {effect}.",
            ],
            # Unknown / low confidence
            "low_confidence": [
                "I suspect {cause} might lead to {effect}, but I need more data.",
                "It is plausible that {cause} results in {effect}, though I am uncertain.",
            ],
            # No rule found
            "no_rule": [
                "I haven't encountered that causal relationship yet. Can you teach me?",
                "That's outside my current knowledge base. Could you explain the cause?",
                "ကျွန်တော် ဒီအကြောင်းကို မသိသေးပါဘူး။ ရှင်းပြပေးနိုင်မလားခင်ဗျာ။",
                "ဒါက ကျွန်တော့်အတွက် အသစ်အဆန်းပါ။ ဘာဖြစ်လို့ဖြစ်တာလဲ ပြောပြပါလား။",
            ],
            # Conversation
            "greeting": ["မင်္ဂလာပါ။ ဘယ်လိုကူညီပေးရမလဲခင်ဗျာ။", "Hello! I am MURE. Ready to reason about causes.", "ဟိုင်း! ဘာသိချင်လဲ။"],
            "thanks": ["You're very welcome!", "Glad I could clear that up!", "ရပါတယ်။", "ပျော်ရွှင်ပါတယ်။"],
            "goodbye": ["Goodbye! Feel free to return when you have more questions.", "See you next time!", "တာ့တာ!", "နောက်မှပြန်တွေ့မယ်။"],
        }
        
        # Myanmar templates
        self.my_templates = {
            "direct": [
                "{cause} ကြောင့် {effect} ဖြစ်ပေါ်လာပါတယ်။",
                "{cause} က {effect} ကိုဖြစ်စေပါတယ်။",
                "{cause} ရှိရင် {effect} ဖြစ်တတ်ပါတယ်။",
            ],
            "when": [
                "{cause} ဖြစ်လာရင် {effect} လိုက်ပါဖြစ်ပေါ်လာပါတယ်။",
                "{cause} တဲ့အခါ {effect} ဖြစ်တာကို တွေ့ရပါတယ်။",
            ],
            "reason": [
                "{effect} ဖြစ်တာကတော့ {cause} ကြောင့်ပဲ ဖြစ်ပါတယ်။",
                "{cause} ဖြစ်တဲ့အတွက်ကြောင့် {effect} ဖြစ်ပါတယ်။",
            ],
        }
    
    def add_template(self, category: str, template: str):
        if category in self.templates:
            self.templates[category].append(template)
        elif category in self.my_templates:
            self.my_templates[category].append(template)
        else:
            # Create a new category if it doesn't exist
            self.templates[category] = [template]
    
    def detect_language(self, thought: Dict) -> str:
        """Detect language from thought or context"""
        # Check subject/object for Myanmar characters
        subject = thought.get('subject', '')
        for char in subject:
            if '\u1000' <= char <= '\u109F':
                return "my"
        return "en"
    
    def translate(self, thought: Dict) -> str:
        """Main translation function"""
        
        cause = thought.get('cause', '')
        effect = thought.get('effect', '')
        confidence = thought.get('confidence', 0.5)
        chain = thought.get('chain', []) # Expected list of effects
        qtype = thought.get('question_type', 'general')
        lang = self.detect_language(thought)
        
        # Step 1: Check if we have a rule
        if thought.get('subject') == 'unknown' and thought.get('object') == 'unknown':
            return random.choice(self.templates["no_rule"])
        
        # Step 2: Handle low confidence
        if confidence < 0.6:
            template = random.choice(self.templates["low_confidence"])
            return template.format(cause=cause, effect=effect)
        
        # Step 3: Handle causal chain (more descriptively)
        if len(chain) >= 2:
            if lang == "en":
                # Create a sequence string like "A, then B, and finally C"
                sequence = f"{chain[0]}, then {', then '.join(chain[1:-1]) + ', and finally ' if len(chain) > 2 else ''}{chain[-1]}"
                return f"{cause} starts a chain: {sequence}."
            else:
                # Same in Myanmar
                sequence = f"{chain[0]}၊ ပြီးတော့ {chain[1]}၊ နောက်ဆုံးတော့ {chain[-1]} ဖြစ်လာပါတယ်။"
                return f"{cause} ကြောင့် {sequence}"
        
        # Step 4: Use question-type specific templates
        if qtype == "what":
            template = random.choice(self.templates["what_response"])
        elif qtype == "why":
            template = random.choice(self.templates["why_response"])
        elif qtype == "how":
            template = random.choice(self.templates["how_response"])
        else:
            template = random.choice(self.templates["direct_cause"])
        
        # Step 5: Language-specific formatting
        if lang == "my":
            if "when" in template.lower() or "when" in qtype:
                template = random.choice(self.my_templates["when"])
            elif "why" in template.lower() or "why" in qtype:
                template = random.choice(self.my_templates["reason"])
            else:
                template = random.choice(self.my_templates["direct"])
        
        return template.format(cause=cause, effect=effect)
    
    # Conversation handlers (SVO-CC thought → Natural response)
    def handle_greeting(self) -> str:
        return random.choice(self.templates["greeting"])
    
    def handle_thanks(self) -> str:
        return random.choice(self.templates["thanks"])
    
    def handle_goodbye(self) -> str:
        return random.choice(self.templates["goodbye"])


# ============================================
# Complete MURE with CoT
# ============================================

class MUREComplete:
    """
    Complete MURE with:
    - SVO-CC internal thinking
    - Chain of Thought reasoning
    - Natural language output
    """
    
    def __init__(self, rules_path: str = None):
        self.cot = MURECoT(rules_path)
        self.translator = SVOCCTranslator()
        
        # Conversation intent mapping
        self.intents = {
            "greeting": ["hello", "hi", "hey", "မင်္ဂလာ", "ဟိုင်း"],
            "thanks": ["thank", "thanks", "ကျေးဇူး"],
            "goodbye": ["bye", "goodbye", "quit", "exit", "သွားတော့"],
        }
    
    def detect_intent(self, text: str) -> str:
        text_lower = text.lower()
        for intent, keywords in self.intents.items():
            if any(kw in text_lower for kw in keywords):
                return intent
        return "question"
    
    def respond(self, user_input: str) -> str:
        intent = self.detect_intent(user_input)
        
        if intent == "greeting":
            return self.translator.handle_greeting()
        elif intent == "thanks":
            return self.translator.handle_thanks()
        elif intent == "goodbye":
            return self.translator.handle_goodbye()
        else:
            # Use CoT + Translation pipeline
            return self.cot.respond(user_input)
