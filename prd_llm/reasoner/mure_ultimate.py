import re
import random
from typing import Dict, List, Tuple
from dataclasses import dataclass
from prd_llm.reasoner.mure_engine import MUREEngine
from prd_llm.reasoner.mure_cot_speaker import SVOCCTranslator
from prd_llm.brain.model import PRDLLMBrain

@dataclass
class SVOCCThought:
    """Internal SVO-CC thought structure"""
    cause: str
    effect: str
    confidence: float
    chain: List[str]
    question_type: str
    raw_input: str = ""

class ConsistencyGuardrail:
    """
    Verifies that translated output maintains logical consistency
    with the original SVO-CC thought.
    """
    
    def __init__(self):
        self.mismatch_count = 0
        self.total_checks = 0
    
    def reverse_translate(self, text: str) -> Dict[str, str]:
        text_lower = text.lower()
        
        # Pattern 1: "X causes Y" / "X leads to Y"
        patterns = [
            r'(\w+(?:\s+\w+)*)\s+causes\s+(\w+(?:\s+\w+)*)',
            r'(\w+(?:\s+\w+)*)\s+leads to\s+(\w+(?:\s+\w+)*)',
            r'(\w+(?:\s+\w+)*)\s+results in\s+(\w+(?:\s+\w+)*)',
            r'when\s+(\w+(?:\s+\w+)*)\s*,\s*(\w+(?:\s+\w+)*)\s+happens',
            r'(\w+(?:\s+\w+)*)\s+ကြောင့်\s+(\w+(?:\s+\w+)*)',
            r'(\w+(?:\s+\w+)*)\s+က\s+(\w+(?:\s+\w+)*)\s+ကိုဖြစ်စေတယ်',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text_lower)
            if match:
                return {
                    "cause": match.group(1).strip(),
                    "effect": match.group(2).strip(),
                    "found": True
                }
        
        return {"cause": None, "effect": None, "found": False}
    
    def verify(self, original_thought: SVOCCThought, generated_text: str) -> Tuple[bool, str]:
        self.total_checks += 1
        
        extracted = self.reverse_translate(generated_text)
        
        if not extracted["found"]:
            self.mismatch_count += 1
            return False, self._generate_safe_response(original_thought)
        
        original_cause = original_thought.cause.lower()
        original_effect = original_thought.effect.lower()
        extracted_cause = extracted["cause"].lower()
        extracted_effect = extracted["effect"].lower()
        
        cause_match = (original_cause in extracted_cause or extracted_cause in original_cause)
        effect_match = (original_effect in extracted_effect or extracted_effect in original_effect)
        
        if cause_match and effect_match:
            return True, generated_text
        else:
            self.mismatch_count += 1
            corrected = self._generate_corrected_response(original_thought, extracted)
            return False, corrected
    
    def _generate_safe_response(self, thought: SVOCCThought) -> str:
        cause = thought.cause
        effect = thought.effect
        
        templates = [
            f"{cause} causes {effect}.",
            f"{cause} leads to {effect}.",
        ]
        
        return random.choice(templates)
    
    def _generate_corrected_response(self, original: SVOCCThought, extracted: Dict) -> str:
        cause = original.cause
        effect = original.effect
        
        if extracted["cause"] and extracted["cause"] != cause:
            return f"To clarify, {cause} causes {effect}, not {extracted['cause']}."
        elif extracted["effect"] and extracted["effect"] != effect:
            return f"Actually, {cause} leads to {effect}, not {extracted['effect']}."
        else:
            return f"{cause} causes {effect}."
    
    def get_stats(self) -> Dict:
        return {
            "total_checks": self.total_checks,
            "mismatches": self.mismatch_count,
            "accuracy_pct": round((self.total_checks - self.mismatch_count) / max(self.total_checks, 1) * 100, 2)
        }

class MUREUltimate:
    """
    MURE Ultimate with:
    1. SVO-CC Internal Thinking
    2. Chain of Thought Reasoning
    3. Natural Language Translation Layer
    4. Consistency Guardrail (Verification Loop)
    """
    
    def __init__(self, rules_path: str = None):
        self.reasoner = MUREEngine(rules_path) if rules_path else MUREEngine()
        self.translator = SVOCCTranslator()
        self.guardrail = ConsistencyGuardrail()
        self.llm_brain = None
        
        self.intents = {
            "greeting": ["hello", "hi", "hey", "မင်္ဂလာ", "ဟိုင်း"],
            "thanks": ["thank", "thanks", "ကျေးဇူး"],
            "goodbye": ["bye", "goodbye", "quit", "exit", "သွားတော့"],
            "conversational": ["စကားပြော", "ဘာလုပ်နိုင်", "can you", "what can you", "help"],
            "teaching": ["learn", "teach", "causes", "leads to", "ကြောင့်", "ဖြစ်စေတယ်"],
            "template_learning": ["speak like", "phrase it as", "use this format", "ပုံစံ", "ပြော"]
        }
    
    def detect_intent(self, text: str) -> str:
        text_lower = text.lower()
        # Template learning check
        if any(kw in text_lower for kw in self.intents["template_learning"]) and ("{" in text_lower and "}" in text_lower):
            return "template_learning"
        # Teaching check
        if any(kw in text_lower for kw in self.intents["teaching"]):
            if "causes" in text_lower or "leads to" in text_lower or "ကြောင့်" in text_lower:
                return "teaching"
        
        for intent, keywords in self.intents.items():
            if any(kw in text_lower for kw in keywords):
                return intent
        return "question"
    
    def handle_conversational(self, text: str) -> str:
        text_lower = text.lower()
        if "စကားပြော" in text_lower or "can you speak" in text_lower:
            return "Yes, I can speak! I think in causal structures and translate them into natural language."
        if "what can you" in text_lower or "ဘာလုပ်နိုင်" in text_lower:
            return "I can reason about causal relationships. Try asking me 'What causes rain?'"
        return "I'm MURE, a causal reasoning AI. How can I help you?"
    
    def handle_teaching(self, text: str) -> str:
        """Dynamic learning: Add new causal rule from user input"""
        # Improved extraction with multiple patterns
        text_lower = text.lower()
        patterns = [
            r'(.+?)\s+(?:causes|leads to|results in|triggers)\s+(.+)',
            r'(.+?)\s+→\s+(.+)',
            r'(.+?)\s+ကြောင့်\s*(.+?)\s*(?:ဖြစ်|တယ်|သည်|ပေါ်)',
            r'(.+?)\s+ဖြစ်လို့\s*(.+)',
        ]
        
        match = None
        for pat in patterns:
            match = re.search(pat, text_lower)
            if match: break
            
        if match:
            cause = match.group(1).strip()
            effect = match.group(2).strip()
            self.reasoner.add_rule(cause, effect, 0.95, "user_teach")
            return f"I have learned: {cause} causes {effect}. Thank you for teaching me!"
        return "I couldn't understand the rule. Please format it as 'Cause causes Effect' or use '→' or 'ကြောင့်'."
    
    def handle_template_learning(self, text: str) -> str:
        """Add new natural language template from user example"""
        match = re.search(r"'(.*?)'", text)
        if match:
            new_template = match.group(1)
            if "{cause}" in new_template and "{effect}" in new_template:
                # Add to translation layer's templates
                self.translator.templates.setdefault("direct_cause", []).append(new_template)
                return f"Got it! I will use '{new_template}' for my responses."
        return "I couldn't identify the template. Please use quotes: 'Like this {cause} -> {effect}'"
    
    def think(self, user_input: str) -> SVOCCThought:
        result = self.reasoner.reason(user_input)
        
        return SVOCCThought(
            cause=result.get('cause', ''),
            effect=result.get('effect', ''),
            confidence=result.get('confidence', 0.5),
            chain=self._get_causal_chain(result.get('cause', '')),
            question_type=self._detect_question_type(user_input),
            raw_input=user_input
        )
    
    def _get_causal_chain(self, start: str, max_depth: int = 3) -> List[str]:
        chain = []
        raw_chain = self.reasoner.get_causal_chain(start, max_depth)
        for _, effect, _ in raw_chain:
            chain.append(effect)
        return chain
    
    def _detect_question_type(self, text: str) -> str:
        text_lower = text.lower()
        if text_lower.startswith('what'): return "what"
        if text_lower.startswith('why'): return "why"
        if text_lower.startswith('how'): return "how"
        return "general"
    
    def respond(self, user_input: str) -> Tuple[str, Dict]:
        intent = self.detect_intent(user_input)
        
        if intent == "greeting": return self.translator.handle_greeting(), {"source": "greeting"}
        if intent == "thanks": return self.translator.handle_thanks(), {"source": "thanks"}
        if intent == "goodbye": return self.translator.handle_goodbye(), {"source": "goodbye"}
        if intent == "conversational": return self.handle_conversational(user_input), {"source": "conversational"}
        if intent == "teaching": return self.handle_teaching(user_input), {"source": "teaching"}
        if intent == "template_learning": return self.handle_template_learning(user_input), {"source": "template_learning"}
        
        # Reasoning pipeline
        thought = self.think(user_input)
        
        # Fallback to LLM Brain if reasoning confidence is low
        if (not thought.cause or not thought.effect or thought.confidence < 0.5):
            if self.llm_brain is None:
                self.llm_brain = PRDLLMBrain()
            
            llm_response = self.llm_brain.generate(user_input, "Insufficient causal context.")
            return llm_response, {"source": "llm_brain_fallback"}
        
        # Speak & Verify
        generated = self.translator.translate(thought.__dict__)
        is_consistent, final_response = self.guardrail.verify(thought, generated)
        
        return final_response, {
            "source": "reasoned",
            "consistent": is_consistent,
            "cause": thought.cause,
            "effect": thought.effect,
            "confidence": thought.confidence,
            "guardrail_stats": self.guardrail.get_stats()
        }
