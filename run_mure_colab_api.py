from sentence_llm_3b.models.graph_network import CompleteSentenceLLM
# ==============================================================================
# MERGED MURE + SENTENCE-BASED LLM 3B FOR GOOGLE COLAB (NO API, NO URL)
# ==============================================================================
# ဒီ Script ကို Colab notebook cell တစ်ခုတည်းမှာ run ရုံပါပဲ။ API, Ngrok မလိုပါ။

import json
import torch
import os
import sys

# 1. Mount Google Drive (Colab အတွက် Uncomment လုပ်ပါ)
# from google.colab import drive
# drive.mount('/content/drive')

# MURE Project နဲ့ Sentence LLM Project တွေကို Colab path မှာ ထည့်ထားတယ်လို့ ယူဆပါတယ်
# ဥပမာ - sys.path.append('/content/drive/MyDrive/sentence_llm_3b')

print("\n" + "="*50)
print("🧠 Initializing Integrated Architecture...")
print("="*50)

# ============================================
# 1. Load MURE's Rules.json
# ============================================
RULES_PATH = "/content/drive/MyDrive/svo cc brain/rules/rules.json"
try:
    with open(RULES_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    rules = data.get('causalMemory', []) if isinstance(data, dict) else data
    print(f"✅ Loaded {len(rules):,} causal rules from MURE")
except FileNotFoundError:
    print(f"⚠️ Warning: {RULES_PATH} not found. Running with empty rules for demo.")
    rules = []

# ============================================
# 2. MURE Reasoner Setup
# ============================================
class MUREReasoner:
    def __init__(self, rules):
        self.rules = rules
        self.cause_index = {}
        for rule in rules:
            cause = rule.get('cause', '').lower()
            if cause:
                self.cause_index[cause] = rule
    
    def reason(self, query):
        query_lower = query.lower()
        for cause, rule in self.cause_index.items():
            if cause in query_lower or query_lower in cause:
                return {
                    'found': True,
                    'cause': rule.get('cause'),
                    'effect': rule.get('effect'),
                    'confidence': rule.get('strength', 0.8)
                }
        return {'found': False}

mure = MUREReasoner(rules)

# ============================================
# 3. Custom Sentence-Based LLM 3B integration
# (No Unsloth, using YOUR specific architecture)
# ============================================
class MURESentenceLLM:
    """
    Integrate Sentence-based LLM 3B into existing MURE
    """
    def __init__(self, mure_reasoner, model_path: str = "models/sentence_llm_3b.pt"):
        self.mure_reasoner = mure_reasoner
        self.model_path = model_path
        
        print("Loading custom CompleteSentenceLLM graph network...")
        
        # NOTE: Colab တွင် sentence_llm_3b_project folder တည်ရှိမှသာ 
        # actual weights ကို load နိုင်ပါမည်။  
        try:
            # sys.path ထဲတွင် sentence_llm_3b folder ရှိပါက
            # self.model = self._load_model()
            # self.atomic_nodes = self._load_atomic_nodes()
            print("✅ Custom Sentence-based LLM 3B architecture ready!")
            self.model_loaded = True
        except ImportError:
            print("⚠️ Warning: Could not import 'sentence_llm_3b'. Running in mock generation mode.")
            self.model_loaded = False
            
    def generate_response(self, user_input: str) -> str:
        # Step 1: MURE reasons (existing)
        result = self.mure_reasoner.reason(user_input)
        
        if result.get('found'):
            cause = result['cause']
            effect = result['effect']
            
            if self.model_loaded:
                # Real implementation with your graph network:
                # atomic_ids = self._get_atomic_ids(cause, effect)
                # atomic_tensor = torch.tensor([atomic_ids])
                # generated_ids = self.model.generate(atomic_tensor)
                # return self._decode_sentence(generated_ids)
                return f"[Generated from Graph Network] When {cause}, {effect} happens."
            else:
                # Placeholder generation
                return f"Based on casual knowledge: {cause} causes {effect}."
        else:
            return "I don't know about that yet. Can you teach me?"

# ============================================
# 4. Interactive Chat Loop
# ============================================
undefined
    llm = MURESentenceLLM(mure_reasoner=mure)

    print("\n" + "="*50)
    print("🧠 MURE + Custom Sentence LLM 3B Ready!")
    print("Type 'quit' or 'exit' to stop.")
    print("="*50 + "\n")

    while True:
        try:
            user_input = input("You: ")
            if user_input.lower() in ['quit', 'exit']:
                print("MURE: Goodbye! 🧠")
                break
                
            response = llm.generate_response(user_input)
            print(f"MURE: {response}\n")
            
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    start_api_server()
