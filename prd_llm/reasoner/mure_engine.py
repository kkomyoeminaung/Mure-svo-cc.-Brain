import json
import os
from collections import defaultdict

class MUREEngine:
    def __init__(self, rules_path="/content/drive/MyDrive/svo cc brain/rules/rules.json"):
        self.rules_path = rules_path
        self.rules = self.load_rules()
        self.cause_index = defaultdict(list)
        self.build_index()

    def load_rules(self):
        if os.path.exists(self.rules_path):
            with open(self.rules_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data.get('causalMemory', [])
                return data
        return []

    def build_index(self):
        for rule in self.rules:
            cause_val = str(rule.get('cause', '')).lower()
            self.cause_index[cause_val].append(rule)

    def reason(self, query):
        query = query.lower()
        if query in self.cause_index:
            best_rule = max(self.cause_index[query], key=lambda x: x.get('strength', x.get('confidence', 0.5)))
            # Provide a deeper chain
            chain = self.get_causal_chain(query, 5)
            # Find the final effect in the chain
            final_effect = chain[-1][1] if chain else best_rule['effect']
            return {
                "chain": chain,
                "confidence": best_rule.get('strength', best_rule.get('confidence', 0.5)),
                "answer": final_effect,
                "cause": best_rule['cause'],
                "effect": best_rule['effect']
            }
        return {"chain": [], "confidence": 0.0, "answer": "", "cause": "", "effect": ""}

    def add_rule(self, cause, effect, confidence, source):
        # Check if rule exists
        existing_rules = [r for r in self.rules if r['cause'].lower() == cause.lower() and r['effect'].lower() == effect.lower()]
        
        if existing_rules:
            # Update strength
            rule = existing_rules[0]
            current_strength = rule.get('strength', rule.get('confidence', 0.5))
            rule['strength'] = min(1.0, current_strength + 0.1 * confidence)
            rule['source'] = 'reinforced'
        else:
            # Create new rule
            rule = {"cause": cause, "effect": effect, "strength": confidence, "source": source}
            self.rules.append(rule)
            self.cause_index[cause.lower()].append(rule)
        
        # Persist to disk
        try:
            os.makedirs(os.path.dirname(self.rules_path), exist_ok=True)
            with open(self.rules_path, 'w', encoding='utf-8') as f:
                output = {"causalMemory": self.rules}
                json.dump(output, f, indent=4)
        except Exception as e:
            print(f"Error saving rules: {e}")

    def validate(self, question, answer):
        # Simplified validation: check if answer matches known effect
        result = self.reason(question)
        if result['confidence'] > 0.5:
             return {"is_valid": answer.lower() in result['effect'].lower(), "confidence": result['confidence'], "suggestion": result['effect']}
        return {"is_valid": True, "confidence": 0.0, "suggestion": ""}

    def get_causal_chain(self, start_concept, max_depth):
        chain = []
        visited = set()
        current = start_concept.lower()
        for _ in range(max_depth):
            if current in self.cause_index and current not in visited:
                visited.add(current)
                best_rule = max(self.cause_index[current], key=lambda x: x.get('strength', x.get('confidence', 0.5)))
                chain.append((best_rule['cause'], best_rule['effect'], best_rule.get('strength', best_rule.get('confidence', 0.5))))
                current = best_rule['effect'].lower()
            else:
                break
        return chain

    def get_all_rules(self):
        return self.rules

    def get_stats(self):
        return {"rule_count": len(self.rules)}
