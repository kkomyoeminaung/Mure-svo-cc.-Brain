# ==============================================================================
# MURE + SENTENCE-BASED LLM 3B API SERVER FOR GOOGLE COLAB
# ==============================================================================
import os
import json
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from threading import Thread

app = FastAPI(title="Colab MURE API")

# 1. Workspace Path
BASE_DIR = '/content/drive/MyDrive/svo cc brain'
RULES_PATH = os.path.join(BASE_DIR, 'rules_synthetic_5M.jsonl')

class MUREReasoner:
    def __init__(self, rules_path):
        self.rules_path = rules_path
        self.rules = []
        self._load_rules()

    def _load_rules(self):
        if os.path.exists(self.rules_path):
            print(f"📖 Loading rules from {self.rules_path}")
            # Speed load: only first 10k for API responsiveness
            with open(self.rules_path, 'r') as f:
                for i, line in enumerate(f):
                    self.rules.append(json.loads(line))
                    if i > 10000: break 
        else:
            print("⚠️ Rules file not found.")

    def reason(self, query):
        q = query.lower()
        for rule in self.rules:
            if rule['cause'].lower() in q:
                return rule
        return None

reasoner = MUREReasoner(RULES_PATH)

class Query(BaseModel):
    message: str

@app.get("/health")
def health():
    return {"status": "online", "model": "MURE-SVO 3B"}

@app.post("/chat")
def chat(req: Query):
    res = reasoner.reason(req.message)
    if res:
        return {
            "reply": f"Based on causal logic: {res['effect']}",
            "frame": res,
            "source": "colab_python_backend"
        }
    return {"reply": "I am still learning this pattern.", "source": "colab_python_backend"}

def run_server():
    # Try to use ngrok or localtunnel if available to give the user a public URL
    try:
        from pyngrok import ngrok
        import nest_asyncio
        nest_asyncio.apply()
        
        # Open a ngrok tunnel to the dev server
        public_url = ngrok.connect(8000)
        print("*"*60)
        print("✅ Ngrok Tunnel Established!")
        print(f"👉 PUBLIC API URL: {public_url.public_url}")
        print("👉 React Frontend ထဲက Settings မှာ အထက်ပါ URL ကို ထည့်ပေးပါ။")
        print("*"*60)
    except ImportError:
        print("💡 ngrok မရှိပါ။ (pip install pyngrok nest-asyncio ဖြင့် install လုပ်နိုင်ပါသည်)")
        print("💡 ngrok အစား  !npm install -g localtunnel\n!lt --port 8000  ကိုသုံးလို့ရပါတယ်")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    print("🚀 Starting MURE API Server on port 8000...")
    print("💡 Colab မှာ သုံးရင် ngrok သုံးပြီး public URL ထုတ်ဖို့ မမေ့ပါနဲ့။")
    run_server()
