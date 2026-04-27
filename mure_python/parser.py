import re
from typing import Dict, Optional, Tuple, List
from dataclasses import dataclass
from enum import Enum

from .negation import NegationHandler
from .modals import ModalsHandler
from .tense import TenseHandler
from .conditionals import ConditionalsHandler
from .passive import PassiveHandler
from .comparatives import ComparativesHandler
from .possessives import PossessivesHandler
from .pronoun_resolver import PronounResolver
from .conjunctions import ConjunctionsHandler
from .embedded_clauses import EmbeddedClausesHandler

# Level 2 handlers
from .numerical import NumericalHandler
from .temporal import TemporalHandler
from .spatial import SpatialHandler
from .quantifiers import QuantifierHandler
from .certainty import CertaintyHandler
from .intentionality import IntentionalityHandler
from .emotion import EmotionHandler
from .hypotheticals import HypotheticalsHandler
from .counterfactuals import CounterfactualsHandler
from .metaphor import MetaphorHandler

class SentenceType(Enum):
    STANDARD = "standard"      # SVO-C
    CAUSAL = "causal"          # X causes Y
    IMPERSONAL = "impersonal"  # It is raining
    EXISTENTIAL = "existential" # There is/are
    WEATHER = "weather"        # Raining (no subject)
    IMPERATIVE = "imperative"  # Go home
    ELLIPTICAL = "elliptical"  # Yes/No
    QUESTION = "question"      # What/Why/How


@dataclass
class ParsedFrame:
    """Complete parsed sentence frame"""
    sentence_type: SentenceType
    subject: Optional[str] = None
    verb: Optional[str] = None
    object: Optional[str] = None
    complement: Optional[str] = None
    cause: Optional[str] = None
    effect: Optional[str] = None
    dummy_subject: Optional[str] = None
    existential: Optional[str] = None
    weather_verb: Optional[str] = None
    imperative_verb: Optional[str] = None
    question_word: Optional[str] = None
    is_question: bool = False
    causal_strength: float = 0.5
    raw_text: str = ""
    
    # Level 1 features
    is_negated: bool = False
    modal_strength: Optional[float] = None
    tense: str = "present"
    is_conditional: bool = False
    condition: Optional[str] = None
    is_passive: bool = False
    is_comparative: bool = False
    comparative_details: Optional[Dict] = None
    possessives: List[Dict] = None
    embedded_clause_prefix: Optional[str] = None

    # Level 2 features
    has_numbers: bool = False
    numbers: List[float] = None
    has_temporal: bool = False
    temporal_info: Optional[Dict] = None
    has_spatial: bool = False
    spatial_info: List[Dict] = None
    quantifier_strength: Optional[float] = None
    certainty_strength: Optional[float] = None
    is_intentional: bool = False
    intent_verb: Optional[str] = None
    has_emotion: bool = False
    emotion: Optional[str] = None
    emotion_polarity: Optional[str] = None
    is_hypothetical: bool = False
    is_counterfactual: bool = False
    has_idiom: bool = False
    literal_meaning: Optional[str] = None


class CompleteParser:
    """Parser that handles ALL sentence types"""
    
    def __init__(self):
        # Stative verbs (need complement, not object)
        self.stative_verbs = {
            'is', 'am', 'are', 'was', 'were', 'be', 'being', 'been',
            'seem', 'seems', 'seemed', 'appear', 'appears', 'appeared',
            'become', 'becomes', 'became', 'remain', 'remains', 'remained',
            'stay', 'stays', 'stayed', 'look', 'looks', 'looked',
            'feel', 'feels', 'felt', 'sound', 'sounds', 'sounded'
        }
        
        # Causal verbs
        self.causal_verbs = {
            'caused', 'cause', 'causes', 'leading to', 'resulted in',
            'result in', 'results in', 'made', 'makes', 'triggered',
            'ကြောင့်', 'လို့', 'ဖြစ်စေတယ်', 'ဖြစ်လို့'
        }
        
        # Weather verbs (can stand alone)
        self.weather_verbs = {
            'rain', 'rains', 'raining', 'rained',
            'snow', 'snows', 'snowing', 'snowed',
            'storm', 'storms', 'storming', 'stormed',
            'hail', 'hails', 'hailing', 'hailed'
        }
        
        # Question words
        self.question_words = {
            'what', 'why', 'how', 'when', 'where', 'who', 'which',
            'ဘာ', 'ဘာလို့', 'ဘယ်လို', 'ဘယ်တော့', 'ဘယ်မှာ', 'ဘယ်သူ'
        }
        
        # Imperative verbs
        self.imperative_verbs = {
            'go', 'come', 'run', 'walk', 'sit', 'stand', 'stop', 'start',
            'help', 'please', 'don\'t', 'do not', 'let\'s', 'let us',
            'သွား', 'လာ', 'ထိုင်', 'ရပ်', 'ကူညီ'
        }
        
        # Elliptical responses
        self.elliptical_responses = {
            'yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'alright',
            'no', 'nope', 'nah', 'not', 'never',
            'thanks', 'thank', 'ဟုတ်', 'မဟုတ်', 'ကျေးဇူး'
        }
        
        # Level 1 Handlers
        self.neg_handler = NegationHandler()
        self.modal_handler = ModalsHandler()
        self.tense_handler = TenseHandler()
        self.cond_handler = ConditionalsHandler()
        self.passive_handler = PassiveHandler()
        self.comp_handler = ComparativesHandler()
        self.poss_handler = PossessivesHandler()
        self.pronoun_resolver = PronounResolver()
        self.conj_handler = ConjunctionsHandler()
        self.embed_handler = EmbeddedClausesHandler()
        
        # Level 2 Handlers
        self.numerical_handler = NumericalHandler()
        self.temporal_handler = TemporalHandler()
        self.spatial_handler = SpatialHandler()
        self.quantifier_handler = QuantifierHandler()
        self.certainty_handler = CertaintyHandler()
        self.intent_handler = IntentionalityHandler()
        self.emotion_handler = EmotionHandler()
        self.hypo_handler = HypotheticalsHandler()
        self.counter_handler = CounterfactualsHandler()
        self.metaphor_handler = MetaphorHandler()

        self.context = {}

    def _apply_handlers(self, text: str, frame: ParsedFrame) -> ParsedFrame:
        """Apply all NLP handlers to the frame"""
        # Resolve Pronouns First
        resolved = self.pronoun_resolver.process(text, self.context)
        processed_text = resolved['resolved_text']
        
        # Metaphors / Idioms
        metaphor_res = self.metaphor_handler.process(processed_text)
        if metaphor_res['has_idiom']:
            frame.has_idiom = True
            frame.literal_meaning = metaphor_res['literal_meaning']
            processed_text = metaphor_res['resolved_text']
            
        # Extract embedded clauses
        embed_res = self.embed_handler.process(processed_text)
        if embed_res['has_embedded']:
            frame.embedded_clause_prefix = embed_res['prefix']
            processed_text = embed_res['main_clause']
            
        # Modals
        modal_strength = self.modal_handler.process(processed_text)
        if modal_strength is not None:
            frame.modal_strength = modal_strength
            frame.causal_strength = modal_strength
            
        # Negation
        frame.is_negated = self.neg_handler.process(processed_text)
        if frame.is_negated:
            frame.causal_strength = 0.0
            
        # Tense
        frame.tense = self.tense_handler.process(processed_text)
        
        # Conditionals
        cond_res = self.cond_handler.process(processed_text)
        if cond_res['is_conditional']:
            frame.is_conditional = True
            frame.condition = cond_res['condition']
            processed_text = cond_res['result'] or processed_text
            
        # Passive
        pass_res = self.passive_handler.process(processed_text)
        if pass_res['is_passive']:
            frame.is_passive = True
            processed_text = pass_res['active_form']
            
        # Comparatives
        comp_res = self.comp_handler.process(processed_text)
        if comp_res['is_comparative']:
            frame.is_comparative = True
            frame.comparative_details = comp_res
            
        # Possessives 
        poss_res = self.poss_handler.process(processed_text)
        if poss_res['has_possessive']:
            frame.possessives = poss_res['pairs']

        # Level 2 Handlers
        # Numerical
        num_res = self.numerical_handler.process(processed_text)
        if num_res['has_numbers']:
            frame.has_numbers = True
            frame.numbers = num_res['numbers']

        # Temporal
        temp_res = self.temporal_handler.process(processed_text)
        if temp_res['has_temporal']:
            frame.has_temporal = True
            frame.temporal_info = temp_res['info']

        # Spatial
        spat_res = self.spatial_handler.process(processed_text)
        if spat_res['has_spatial']:
            frame.has_spatial = True
            frame.spatial_info = spat_res['info']

        # Quantifier
        quant_res = self.quantifier_handler.process(processed_text)
        if quant_res['has_quantifier']:
            frame.quantifier_strength = quant_res['strength']
            
        # Certainty
        cert_res = self.certainty_handler.process(processed_text)
        if cert_res['has_certainty']:
            frame.certainty_strength = cert_res['strength']
            frame.causal_strength = cert_res['strength']
            
        # Intentionality
        intent_res = self.intent_handler.process(processed_text)
        if intent_res['is_intentional']:
            frame.is_intentional = True
            frame.intent_verb = intent_res['intent_verb']
            
        # Emotion
        emo_res = self.emotion_handler.process(processed_text)
        if emo_res['has_emotion']:
            frame.has_emotion = True
            frame.emotion = emo_res['emotion']
            frame.emotion_polarity = emo_res['polarity']
            
        # Hypotheticals
        hypo_res = self.hypo_handler.process(processed_text)
        if hypo_res['is_hypothetical']:
            frame.is_hypothetical = True
            
        # Counterfactuals
        count_res = self.counter_handler.process(processed_text)
        if count_res['is_counterfactual']:
            frame.is_counterfactual = True

        return frame, processed_text

    def parse_multiple(self, text: str) -> List[ParsedFrame]:
        # Handle conjunctions
        conj_res = self.conj_handler.process(text)
        frames = []
        for clause in conj_res['clauses']:
            frames.append(self.parse(clause))
        return frames

    def parse(self, sentence: str) -> ParsedFrame:
        """Parse any sentence into its structure"""
        if not sentence or not sentence.strip():
            return ParsedFrame(sentence_type=SentenceType.ELLIPTICAL, raw_text=sentence)
        
        text = sentence.strip()
        text_lower = text.lower()
        words = text_lower.split()
        
        frame = ParsedFrame(sentence_type=SentenceType.STANDARD, raw_text=text)
        
        # Apply Handlers
        frame, text_to_parse = self._apply_handlers(text, frame)
        text_lower = text_to_parse.lower()
        words = text_lower.split()
        
        # 1. Check for question
        if words and words[0] in self.question_words:
            frame.sentence_type = SentenceType.QUESTION
            frame.is_question = True
            frame.question_word = words[0]
            # Parse rest of sentence
            rest = ' '.join(words[1:]) if len(words) > 1 else ''
            if rest:
                sub_frame = self._parse_rest(rest)
                frame.subject = sub_frame.subject
                frame.verb = sub_frame.verb
                frame.object = sub_frame.object
                frame.complement = sub_frame.complement
            return frame
        
        # 2. Check for elliptical
        if text_lower in self.elliptical_responses or len(words) <= 2:
            frame.sentence_type = SentenceType.ELLIPTICAL
            frame.complement = text_to_parse
            return frame
        
        # 3. Check for causal
        causal = self._parse_causal(text_to_parse)
        if causal:
            frame.sentence_type = SentenceType.CAUSAL
            frame.cause = causal['cause']
            frame.effect = causal['effect']
            frame.verb = causal.get('verb', 'causes')
            
            # Store context
            self.context['subject'] = frame.cause
            return frame
        
        # 4. Parse rest
        parsed_rest = self._parse_rest(text_to_parse, raw_text=text_to_parse)
        frame.sentence_type = parsed_rest.sentence_type
        frame.existential = parsed_rest.existential
        frame.weather_verb = parsed_rest.weather_verb
        frame.dummy_subject = parsed_rest.dummy_subject
        frame.imperative_verb = parsed_rest.imperative_verb
        frame.subject = parsed_rest.subject
        frame.verb = parsed_rest.verb
        frame.object = parsed_rest.object
        frame.complement = parsed_rest.complement
        
        if frame.subject:
            self.context['subject'] = frame.subject
            
        return frame
    
    def _parse_rest(self, text: str, raw_text: str = None) -> ParsedFrame:
        """Parse non-question sentences"""
        text_lower = text.lower()
        words = text_lower.split()
        
        # Check existential (There is/are)
        existential = self._parse_existential(text_lower)
        if existential:
            return ParsedFrame(
                sentence_type=SentenceType.EXISTENTIAL,
                existential=existential['there'],
                verb=existential['verb'],
                object=existential['object'],
                raw_text=raw_text or text
            )
        
        # Check weather (It is raining)
        weather = self._parse_weather(text_lower)
        if weather:
            return ParsedFrame(
                sentence_type=SentenceType.WEATHER,
                weather_verb=weather,
                raw_text=raw_text or text
            )
        
        # Check impersonal (It seems...)
        impersonal = self._parse_impersonal(text_lower)
        if impersonal:
            return ParsedFrame(
                sentence_type=SentenceType.IMPERSONAL,
                dummy_subject=impersonal['dummy'],
                verb=impersonal['verb'],
                complement=impersonal['complement'],
                raw_text=raw_text or text
            )
        
        # Check imperative
        imperative = self._parse_imperative(text_lower)
        if imperative:
            return ParsedFrame(
                sentence_type=SentenceType.IMPERATIVE,
                imperative_verb=imperative,
                raw_text=raw_text or text
            )
        
        # Default: SVO-C
        svo_c = self._parse_svo_c(text_lower)
        if svo_c:
            return ParsedFrame(
                sentence_type=SentenceType.STANDARD,
                subject=svo_c.get('subject'),
                verb=svo_c.get('verb'),
                object=svo_c.get('object'),
                complement=svo_c.get('complement'),
                raw_text=raw_text or text
            )
        
        # Fallback
        return ParsedFrame(
            sentence_type=SentenceType.STANDARD,
            raw_text=raw_text or text
        )
    
    def _parse_causal(self, sentence: str) -> Optional[Dict]:
        """Parse causal sentences"""
        words = sentence.lower().split()
        
        for i, word in enumerate(words):
            if word in self.causal_verbs:
                cause = ' '.join(words[:i])
                effect = ' '.join(words[i+1:])
                return {'cause': cause, 'effect': effect, 'verb': word}
        
        # Myanmar patterns
        if 'ကြောင့်' in sentence:
            parts = sentence.split('ကြောင့်')
            if len(parts) == 2:
                return {'cause': parts[0].strip(), 'effect': parts[1].strip(), 'verb': 'ကြောင့်'}
        
        if 'လို့' in sentence:
            parts = sentence.split('လို့')
            if len(parts) == 2:
                return {'cause': parts[0].strip(), 'effect': parts[1].strip(), 'verb': 'လို့'}
        
        return None
    
    def _parse_existential(self, sentence: str) -> Optional[Dict]:
        """Parse 'There is/are' sentences"""
        patterns = [
            r'^there (is|are|was|were|will be|has been|have been) (.+)$',
            r"^there's (.+)$",
            r'^there (?:is|are) (.+)$',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, sentence, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 2:
                    return {'there': 'there', 'verb': groups[0], 'object': groups[1]}
                elif len(groups) == 1:
                    return {'there': 'there', 'verb': 'is', 'object': groups[0]}
        
        return None
    
    def _parse_weather(self, sentence: str) -> Optional[str]:
        """Parse weather expressions"""
        # Check for "it is raining"
        if sentence.startswith('it is ') or sentence.startswith("it's "):
            rest = sentence.replace('it is ', '').replace("it's ", '')
            for wv in self.weather_verbs:
                if rest.startswith(wv):
                    return wv
        
        # Check for standalone
        for wv in self.weather_verbs:
            if sentence == wv or sentence.startswith(wv + ' '):
                return wv
        
        return None
    
    def _parse_impersonal(self, sentence: str) -> Optional[Dict]:
        """Parse 'It is ...' impersonal sentences"""
        patterns = [
            r'^it (is|was|will be|seems|appears) (.+)$',
            r"^it's (.+)$",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, sentence, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 2:
                    return {'dummy': 'it', 'verb': groups[0], 'complement': groups[1]}
                elif len(groups) == 1:
                    return {'dummy': 'it', 'verb': 'is', 'complement': groups[0]}
        
        return None
    
    def _parse_imperative(self, sentence: str) -> Optional[str]:
        """Parse imperative sentences"""
        cleaned = sentence
        if cleaned.startswith('please '):
            cleaned = cleaned[7:]
        
        words = cleaned.split()
        if words and words[0] in self.imperative_verbs:
            return ' '.join(words)
        
        return None
    
    def _parse_svo_c(self, sentence: str) -> Dict[str, Optional[str]]:
        """Parse standard SVO-C sentences"""
        words = sentence.split()
        
        if len(words) < 2:
            return {}
        
        subject = words[0]
        verb = words[1] if len(words) > 1 else None
        
        if len(words) == 2:
            return {'subject': subject, 'verb': verb}
        
        # Stative verb → complement (not object)
        if verb in self.stative_verbs:
            return {
                'subject': subject,
                'verb': verb,
                'complement': ' '.join(words[2:]),
                'object': None
            }
        
        # Transitive verb → object
        return {
            'subject': subject,
            'verb': verb,
            'object': ' '.join(words[2:]),
            'complement': None
        }


# Test
if __name__ == "__main__":
    parser = CompleteParser()
    
    test_sentences = [
        "The sky is cloudy",
        "It is raining",
        "There is a cat",
        "Go home",
        "Yes",
        "Rain causes flooding",
        "What is machine learning?",
        "ဘာလို့ မိုးရွာတာလဲ",
    ]
    
    for s in test_sentences:
        result = parser.parse(s)
        print(f"\nInput: {s}")
        print(f"  Type: {result.sentence_type.value}")
        if result.cause:
            print(f"  Causal: {result.cause} → {result.effect}")
        if result.subject:
            print(f"  Subject: {result.subject}")
        if result.verb:
            print(f"  Verb: {result.verb}")
        if result.complement:
            print(f"  Complement: {result.complement}")
        if result.weather_verb:
            print(f"  Weather: {result.weather_verb}")
