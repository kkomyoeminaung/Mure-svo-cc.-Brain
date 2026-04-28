import asyncio
import sys
from .config import config, init_directories
from .sqlite_storage import SQLiteStorage
from .mure_engine import MUREEngine
from .context_memory import ContextMemory
from .dream_mode import MUREDreamMode

class MUREUltimateAGI:
    def __init__(self):
        print("🚀 Initializing MURE Ultimate AGI...")
        init_directories()
        
        self.storage = SQLiteStorage()
        self.engine = MUREEngine(self.storage)
        self.context = ContextMemory()
        self.dreamer = MUREDreamMode(self.storage)
        
        self._bootstrap_seeds()
        print("🌟 MURE AGI Ready.")

    def _bootstrap_seeds(self):
        seeds = [
            {"cause": "Rain falls", "effect": "Ground becomes wet", "strength": 0.95},
            {"cause": "Temperature increases", "effect": "Molecules move faster", "strength": 0.98},
            {"cause": "You study", "effect": "Knowledge increases", "strength": 0.88},
            {"cause": "Sun shines", "effect": "Temperature rises", "strength": 0.92},
            {"cause": "You exercise", "effect": "Health improves", "strength": 0.90},
            {"cause": "Carbon dioxide increases", "effect": "Global warming accelerates", "strength": 0.94},
            {"cause": "Magnetism occurs", "effect": "Metals are attracted", "strength": 0.97},
            {"cause": "Light hits retina", "effect": "Visual signal sent to brain", "strength": 0.99},
            {"cause": "Interest rates rise", "effect": "Borrowing decreases", "strength": 0.85},
            {"cause": "Virus enters host", "effect": "Immune system responds", "strength": 0.96},
            {"cause": "Force is applied", "effect": "Object accelerates", "strength": 0.99},
            {"cause": "Dehydration occurs", "effect": "Fatigue sets in", "strength": 0.82},
            {"cause": "Supply exceeds demand", "effect": "Prices drop", "strength": 0.89},
            {"cause": "Plants photosynthesize", "effect": "Oxygen is released", "strength": 0.98},
            {"cause": "Gravity pulls", "effect": "Massive objects fall", "strength": 0.99}
        ]
        self.storage.bootstrap_seed(seeds)
        self.engine.refresh_cache()

    def chat(self, user_input: str) -> str:
        # 1. Resolve context
        resolved_input = self.context.resolve_pronouns(user_input)
        
        # 2. Reason
        reasoning = self.engine.reason(resolved_input)
        
        # 3. Generate response
        if reasoning["success"]:
            response = f"Based on causal logic, {reasoning['cause']} results in {reasoning['effect']} (Confidence: {reasoning['confidence']:.2f})."
            if reasoning.get("all_matches"):
                alt = reasoning["all_matches"][0]
                response += f" Secondary possibility: {alt['effect']}."
        else:
            response = "I haven't established a causal link for that yet. I will try to learn it."
            
        # 4. Save to memory
        self.context.add_turn(user_input, response)
        return response

    async def run_dream_mode(self):
        await self.dreamer.start_dream_loop()

# Singleton for easy import
mure_agi = None

def get_mure():
    global mure_agi
    if mure_agi is None:
        mure_agi = MUREUltimateAGI()
    return mure_agi
