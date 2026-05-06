import random
"""
Load and process MURE's rules.json into Level 1, 2, 3 nodes
"""

import json
from typing import List, Dict
from collections import defaultdict
from tqdm import tqdm

class RuleLoader:
    def __init__(self, rules_path: str, max_rules: int = 2000000):
        self.rules_path = rules_path
        self.max_rules = max_rules
        self.rules = []
        
    def load(self) -> List[Dict]:
        try:
            with open(self.rules_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            all_rules = data.get('causalMemory', []) if isinstance(data, dict) else data
            self.rules = all_rules[:self.max_rules]
            print(f"Loaded {len(self.rules):,} causal rules")
        except FileNotFoundError:
            print(f"⚠️ Warning: {self.rules_path} not found. Returning empty rules.")
            self.rules = []
        return self.rules

class AtomicNodeBuilder:
    def __init__(self):
        self.node_types = ['subject', 'verb', 'object', 'cause', 'effect']
        self.nodes = {nt: {} for nt in self.node_types}
        self.next_id = {nt: 0 for nt in self.node_types}
        
    def add_node(self, text: str, node_type: str) -> int:
        text_lower = text.lower().strip()
        if text_lower in self.nodes[node_type]:
            return self.nodes[node_type][text_lower]
        node_id = self.next_id[node_type]
        self.nodes[node_type][text_lower] = node_id
        self.next_id[node_type] += 1
        return node_id
    
    def build_from_rules(self, rules: List[Dict]) -> Dict:
        print("Building Level 1: Atomic Nodes...")
        for rule in tqdm(rules, desc="Building atomic nodes"):
            cause = rule.get('cause', '')
            effect = rule.get('effect', '')
            if cause:
                self.add_node(cause, 'subject')
                self.add_node(cause, 'cause')
                self.add_node('causes', 'verb')
            if effect:
                self.add_node(effect, 'object')
                self.add_node(effect, 'effect')
        return self.nodes

class SentenceNodeBuilder:
    def __init__(self, atomic_builder: AtomicNodeBuilder):
        self.atomic_builder = atomic_builder
        self.sentences = []
        self.sentence_to_id = {}
        
    def build_from_rules(self, rules: List[Dict]) -> List[Dict]:
        print("Building Level 2: Sentence Nodes...")
        for i, rule in enumerate(tqdm(rules, desc="Building sentence nodes")):
            cause = rule.get('cause', '')
            effect = rule.get('effect', '')
            strength = rule.get('strength', 0.8)
            if not cause or not effect:
                continue
            
            templates = [
                f"{cause} causes {effect}.",
                f"When {cause}, {effect} happens.",
                f"{effect} is caused by {cause}.",
                f"Due to {cause}, {effect} occurs.",
                f"If {cause} then {effect}.",
                f"{cause} leads to {effect}.",
                f"{cause} ထို့ကြောင့် {effect} ဖြစ်သည်။",
                f"{cause} ဖြစ်ပေါ်လာတဲ့အခါ {effect} ဖြစ်လာပါတယ်။",
                f"{effect} ဖြစ်ရခြင်းအကြောင်းအရင်းမှာ {cause} ဖြစ်သည်။",
                f"{cause} ကြောင့် {effect} ဖြစ်သည်"
            ]
            # BUG-LOAD-01: Deterministic template selection per rule index
            template_idx = i % len(templates)
            sentence = templates[template_idx]
            
            atomic_ids = {
                'subject': self.atomic_builder.add_node(cause, 'subject'),
                'verb': self.atomic_builder.add_node('causes', 'verb'),
                'object': self.atomic_builder.add_node(effect, 'object'),
                'cause': self.atomic_builder.add_node(cause, 'cause'),
                'effect': self.atomic_builder.add_node(effect, 'effect')
            }
            
            sentence_node = {
                'id': len(self.sentences),
                'text': sentence,
                'cause': cause,
                'effect': effect,
                'strength': strength,
                'atomic_ids': atomic_ids,
                'source_rule_id': i
            }
            self.sentences.append(sentence_node)
            self.sentence_to_id[sentence] = sentence_node['id']
        return self.sentences

class CausalChainBuilder:
    def __init__(self, sentence_builder: SentenceNodeBuilder):
        self.sentence_builder = sentence_builder
        self.chains = []
        self.cause_to_sentence = defaultdict(list)
        
    def build_chains(self, max_depth: int = 4) -> List[Dict]:
        print("Building Level 3: Causal Chain Nodes...")
        for sentence in self.sentence_builder.sentences:
            cause = sentence['cause'].lower()
            self.cause_to_sentence[cause].append(sentence['id'])
            
        for start_sentence in tqdm(self.sentence_builder.sentences[:10000], desc="Building chains"):
            chain = [start_sentence['id']]
            current_id = start_sentence['id']
            for _ in range(max_depth - 1):
                current_effect = self.sentence_builder.sentences[current_id]['effect'].lower()
                visited_in_chain = set(chain)
                next_ids = [nid for nid in self.cause_to_sentence.get(current_effect, []) 
                            if nid not in visited_in_chain]
                if not next_ids:
                    break
                current_id = next_ids[0]
                chain.append(current_id)
                
            if len(chain) >= 2:
                self.chains.append({
                    'id': len(self.chains),
                    'chain_ids': chain,
                    'start_cause': self.sentence_builder.sentences[chain[0]]['cause'],
                    'end_effect': self.sentence_builder.sentences[chain[-1]]['effect'],
                    'length': len(chain)
                })
        return self.chains
