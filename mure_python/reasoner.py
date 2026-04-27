import json
import random
import time
import os
from typing import List, Dict, Optional
from .parser import CompleteParser
from .processor import MyanmarProcessor

class MyanmarMURE:
    def __init__(self, rules_path: str):
        self.rules_path = rules_path
        self.parser = CompleteParser()
        self.causal_memory = []
        self.causal_index = {}
        self.load_rules()

    def load_rules(self):
        if os.path.exists(self.rules_path):
            with open(self.rules_path, 'r', encoding='utf-8') as f:
                self.causal_memory = json.load(f)
            self.rebuild_index()

    def rebuild_index(self):
        self.causal_index = {}
        for rule in self.causal_memory:
            cause = rule.get('cause', '').lower()
            if cause not in self.causal_index:
                self.causal_index[cause] = []
            self.causal_index[cause].append(rule)

    def save_rules(self):
        with open(self.rules_path, 'w', encoding='utf-8') as f:
            json.dump(self.causal_memory, f, indent=2, ensure_ascii=False)

    def find_matches(self, cause: str) -> List[Dict]:
        cause_lower = cause.lower().strip()
        direct = self.causal_index.get(cause_lower, [])
        if direct:
            return sorted(direct, key=lambda x: x.get('strength', 0), reverse=True)
        
        # Word overlap
        is_myanmar = MyanmarProcessor.is_myanmar(cause_lower)
        query_segments = MyanmarProcessor.segment(cause_lower) if is_myanmar else cause_lower.split()
        
        results = []
        for segment in query_segments:
            if segment in self.causal_index:
                results.extend(self.causal_index[segment])
        
        return sorted(results, key=lambda x: x.get('strength', 0), reverse=True)

    def reason(self, text: str):
        # We handle multiple frames from conjunctions
        frames = self.parser.parse_multiple(text)
        results = []
        
        for frame in frames:
            if frame.cause:
                matches = self.find_matches(frame.cause)
                if matches:
                    # Apply negation
                    if frame.is_negated:
                        frame.causal_strength = 0.0
                    else:
                        frame.effect = matches[0]["effect"]
                        # Adjust strength with modal
                        if frame.modal_strength is not None:
                            frame.causal_strength = frame.modal_strength
                        else:
                            frame.causal_strength = matches[0].get("strength", 0.8)
            elif not frame.is_question:
                # Potential new rule to learn (handled externally)
                pass
            results.append(frame)
            
        return results[0] if len(results) == 1 else results

    def learn(self, text: str):
        frames = self.parser.parse_multiple(text)
        learned = False
        
        for frame in frames:
            if frame.cause and frame.effect:
                # Do not learn hypotheticals, counterfactuals, or intents as generic rules
                if getattr(frame, 'is_hypothetical', False) or getattr(frame, 'is_counterfactual', False) or getattr(frame, 'is_intentional', False):
                    continue
                    
                # Handle conditionals
                cause = frame.cause
                if getattr(frame, 'is_conditional', False) and frame.condition:
                    cause = f"({frame.condition}) AND ({cause})"
                    
                strength = 0.8
                if getattr(frame, 'certainty_strength', None) is not None:
                    strength = frame.certainty_strength
                elif getattr(frame, 'quantifier_strength', None) is not None:
                    strength = frame.quantifier_strength
                elif getattr(frame, 'modal_strength', None) is not None:
                    strength = frame.modal_strength
                
                if getattr(frame, 'is_negated', False):
                    strength = 0.0
                
                new_rule = {
                    "cause": cause.lower(),
                    "effect": frame.effect.lower(),
                    "strength": strength,
                    "tense": getattr(frame, 'tense', 'present'),
                    "timestamp": time.time()
                }
                
                if getattr(frame, 'is_passive', False):
                    new_rule['is_passive_origin'] = True
                    
                if getattr(frame, 'has_numbers', False):
                    new_rule['numbers'] = frame.numbers
                if getattr(frame, 'has_temporal', False):
                    new_rule['temporal_info'] = frame.temporal_info
                if getattr(frame, 'has_spatial', False):
                    new_rule['spatial_info'] = frame.spatial_info
                if getattr(frame, 'has_emotion', False):
                    new_rule['emotion'] = frame.emotion
                    
                self.causal_memory.append(new_rule)
                learned = True
                
        if learned:
            self.rebuild_index()
            self.save_rules()
        return learned

