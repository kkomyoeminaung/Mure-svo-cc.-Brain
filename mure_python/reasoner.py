import json
import random
import time
import os
import torch
from typing import List, Dict, Optional
from .parser import CompleteParser
from .processor import MyanmarProcessor
from .web_search import WebSearchService
# Lazy import for model
# from sentence_llm_3b.models.graph_network import CompleteSentenceLLM

class MyanmarMURE:
    def __init__(self, rules_path: str, model_path: Optional[str] = None):
        self.rules_path = rules_path
        self.parser = CompleteParser()
        self.web_search = WebSearchService()
        self.causal_memory = []
        self.causal_index = {}
        self.node_to_id = {}
        self.id_to_node = {}
        self.load_rules()
        
        self.base_reality_rules = {
            "sun rises": "daylight occurs",
            "gravity acts": "objects fall down",
            "fire burns": "heat is produced",
            "water freezes": "ice forms",
            "logic applies": "truth is found"
        }
        
        self.model = None
        self.model_path = model_path or "sentence_llm_3b/models/mure_3b_latest.pth"
        self.load_node_mapping()
        self.init_model()

    def load_node_mapping(self):
        mapping_path = "node_mapping.json"
        if os.path.exists(mapping_path):
            with open(mapping_path, 'r', encoding='utf-8') as f:
                self.node_to_id = json.load(f)
                self.id_to_node = {str(i): node for node, i in self.node_to_id.items()}

    def init_model(self):
        if not self.node_to_id:
            return
            
        try:
            # Lazy import to avoid loading torch/model at top level if not used quickly
            from sentence_llm_3b.models.graph_network import CompleteSentenceLLM
            
            num_nodes = len(self.node_to_id)
            self.model = CompleteSentenceLLM(
                num_subjects=1, num_verbs=1, num_objects=1,
                num_causes=num_nodes, num_effects=num_nodes,
                num_sentences=1000, num_chains=1 # Placeholders
            )
            if os.path.exists(self.model_path):
                self.model.load_state_dict(torch.load(self.model_path, map_location='cpu'))
                self.model.eval()
                print(f"Loaded Neural Weight: {self.model_path}")
        except Exception as e:
            print(f"Neural Model Init Warning: {e}")

    def neural_predict(self, cause_text: str) -> Optional[str]:
        if not self.model or cause_text.lower() not in self.node_to_id:
            return None
            
        try:
            cause_id = self.node_to_id[cause_text.lower()]
            # Create atomic_id [S, V, O, C, E]
            # Simple assumption: we just have the cause ID
            atomic_ids = torch.tensor([[0, 0, 0, cause_id, 0]], dtype=torch.long)
            
            with torch.no_grad():
                token_ids = self.model.generate(atomic_ids, max_tokens=20)
                
            # Decode tokens (reversing the ord(c) + 1 shift from prepare_llm_dataset)
            tokens = token_ids[0].tolist()
            chars = []
            for t in tokens:
                if t <= 0: continue # Padding or EOS
                # Token shift reverse: (t-1) % 50257
                char_code = (t - 1) % 50257
                chars.append(chr(char_code))
            
            return "".join(chars).strip()
        except Exception as e:
            print(f"Neural Prediction Error: {e}")
            return None

    def load_rules(self):
        if not os.path.exists(self.rules_path):
            # Try to find the mure_rules.db in standard location if path is just a dir or default
            db_standard = os.path.join(os.path.dirname(self.rules_path), 'mure_rules.db')
            if os.path.exists(db_standard):
                self.rules_path = db_standard

        if self.rules_path.endswith('.db'):
            try:
                import sqlite3
                conn = sqlite3.connect(self.rules_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT cause, effect, strength, source FROM causal_rules")
                rows = cursor.fetchall()
                self.causal_memory = [dict(r) for r in rows]
                conn.close()
                print(f"MURE Python: Loaded {len(self.causal_memory)} rules from SQLite.")
            except Exception as e:
                print(f"MURE Python ERROR: Failed to load from SQLite. {e}")
                self.causal_memory = []
        elif os.path.exists(self.rules_path):
            with open(self.rules_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    self.causal_memory = data.get('causalMemory', [])
                else:
                    self.causal_memory = data
        
        self.rebuild_index()

    def rebuild_index(self):
        self.causal_index = {}
        for rule in self.causal_memory:
            cause = str(rule.get('cause', '')).lower()
            if cause not in self.causal_index:
                self.causal_index[cause] = []
            self.causal_index[cause].append(rule)

    def save_rules(self):
        if self.rules_path.endswith('.db'):
            try:
                import sqlite3
                conn = sqlite3.connect(self.rules_path)
                cursor = conn.cursor()
                # We only save rules from memory that aren't in DB yet to avoid overhead, 
                # but for simplicity, we just use the API to let TS handle main writes.
                # Python writes are mostly from RAG.
                for rule in self.causal_memory:
                    cursor.execute("""
                        INSERT OR IGNORE INTO causal_rules (cause, effect, strength, source, confidence)
                        VALUES (?, ?, ?, ?, ?)
                    """, (rule.get('cause'), rule.get('effect'), rule.get('strength', 0.8), rule.get('source', 'mure_python_rag'), 0.8))
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"MURE Python: SQLite Save Error: {e}")
        else:
            with open(self.rules_path, 'w', encoding='utf-8') as f:
                output = {"causalMemory": self.causal_memory}
                json.dump(output, f, indent=2, ensure_ascii=False)

    def find_matches(self, cause: str) -> List[Dict]:
        if not cause:
            return []
        cause_lower = cause.lower().strip()
        direct = self.causal_index.get(cause_lower, [])
        if direct:
            return sorted(direct, key=lambda x: x.get('strength', 0), reverse=True)
        
        # Fast Semantic / Substring Match (Replaces strict dict lookup)
        is_myanmar = MyanmarProcessor.is_myanmar(cause_lower)
        query_segments = MyanmarProcessor.segment(cause_lower) if is_myanmar else cause_lower.split()
        
        results = []
        seen = set()
        checks = 0
        
        for key, rules in self.causal_index.items():
            if checks > 500000:  # Increased limit for large rulebases
                break
            checks += 1
            
            # Simple substring or word overlap
            score = 0
            if key in cause_lower or cause_lower in key:
                score = 0.9
            else:
                match_count = sum(1 for seg in query_segments if seg in key)
                score = match_count / len(query_segments) if query_segments else 0
                
            if score > 0.5:
                for rule in rules:
                    # Prevent duplicates and apply score penalty
                    rule_id = f"{rule.get('cause')}_{rule.get('effect')}"
                    if rule_id not in seen:
                        seen.add(rule_id)
                        # Clone rule and adjust strength by match confidence
                        r = dict(rule)
                        r['strength'] = r.get('strength', 0.8) * score
                        results.append(r)
        
        return sorted(results, key=lambda x: x.get('strength', 0), reverse=True)[:10]

    def reason(self, text: str):
        # We handle multiple frames from conjunctions
        frames = self.parser.parse_multiple(text)
        results = []
        
        for frame in frames:
            if frame.cause:
                matches = self.find_matches(frame.cause)
                
                # RAG + Continuous Learning Integration
                if not matches:
                    print(f"RAG Activated: Searching Wikipedia for '{frame.cause}'")
                    wiki_results = self.web_search.search_wikipedia(frame.cause)
                    new_rules_found = 0
                    for res in wiki_results:
                        snippet = res.get('snippet', '')
                        extracted = self.web_search.extract_causal(snippet)
                        for ext in extracted:
                            cause_lower = ext["cause"].lower()
                            effect_lower = ext["effect"].lower()
                            
                            # Check for duplicates to prevent memory bloat/redundancy
                            is_duplicate = False
                            if cause_lower in self.causal_index:
                                for existing_rule in self.causal_index[cause_lower]:
                                    if existing_rule.get('effect') == effect_lower:
                                        is_duplicate = True
                                        break
                                        
                            if not is_duplicate:
                                new_rule = {
                                    "cause": cause_lower,
                                    "effect": effect_lower,
                                    "strength": ext["strength"],
                                    "timestamp": time.time(),
                                    "source": res["source"]
                                }
                                self.causal_memory.append(new_rule)
                                new_rules_found += 1
                                # Also update index instantly
                                if cause_lower not in self.causal_index:
                                    self.causal_index[cause_lower] = []
                                self.causal_index[cause_lower].append(new_rule)
                    
                    if new_rules_found > 0:
                        self.save_rules() # Persist continuous learning in batch
                    matches = self.find_matches(frame.cause) # Try again after learning
                
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
                else:
                    # Neural Fallback if not matches and RAG failed or not yet reached
                    neural_effect = self.neural_predict(frame.cause)
                    if neural_effect:
                        frame.effect = neural_effect
                        frame.causal_strength = 0.6 # Lower confidence for neural generation
                        frame.source = "mure_3b_sentence_llm"
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
                cause = frame.cause.lower().strip()
                effect = frame.effect.lower().strip()

                # 1. Axiomatic Filter: Prevent self-causality (A causes A)
                if cause == effect:
                    print(f"⚠️ MURE Python: Axiomatic Fault Attempted. [A causes A] blocked.")
                    continue
                
                # 2. Logic Invariant (Reality Check)
                if cause in self.base_reality_rules and self.base_reality_rules[cause] != effect:
                    print(f"⚠️ MURE Python: Axiomatic Conflict. [{cause} -> {effect}] rejected.")
                    continue

                # 3. Circularity Check (A -> B -> A)
                reversed_rules = self.causal_index.get(effect, [])
                if any(r.get('effect') == cause for r in reversed_rules):
                    print(f"⚠️ MURE Python: Circular Logic detected for [{cause} -> {effect}]. Blocked.")
                    continue

                if getattr(frame, 'is_conditional', False) and frame.condition:
                    cause = f"({frame.condition}) AND ({cause})"
                    
                # Duplication Check
                existing_rules = self.causal_index.get(cause, [])
                if any(r.get('effect') == effect for r in existing_rules):
                    continue

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

