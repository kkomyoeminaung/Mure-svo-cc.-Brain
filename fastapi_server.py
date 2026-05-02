from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from mure_python.reasoner import MyanmarMURE

app = FastAPI(title="MURE API Backend (Level 1 + Level 2)")

# Allow all origins for easy testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RULES_PATH = os.environ.get("MURE_BRAIN_PATH", "data/brain/rules.json")
mure = MyanmarMURE(rules_path=RULES_PATH)

class ChatRequest(BaseModel):
    message: str

class ReasonRequest(BaseModel):
    message: str

class LearnRequest(BaseModel):
    message: str

@app.get("/health")
def health_check():
    return {"status": "online", "version": "7.0 (MURE-SVO Level 2)"}

@app.get("/stats")
def get_stats():
    return {
        "causalRules": len(mure.causal_memory),
    }

@app.post("/reason")
def reason(req: ReasonRequest):
    try:
        results = mure.reason(req.message)
        # Handle if results is a single dataclass or a list of dataclasses
        if isinstance(results, list):
            frames = [result.__dict__ for result in results]
        else:
            frames = [results.__dict__]
        return {"frames": frames}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/learn")
def learn(req: LearnRequest):
    try:
        success = mure.learn(req.message)
        return {"success": success, "stats": {"causalRules": len(mure.causal_memory)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        # First check if we can learn something new
        learned = mure.learn(req.message)
        
        # Reason to generate response
        results = mure.reason(req.message)
        
        reply = "I understand."
        if isinstance(results, list):
            if not results:
                return {
                    "reply": "I couldn't find a direct causal link for that yet.",
                    "frame": {},
                    "learned": learned,
                    "source": "mure_python_backend",
                    "stats": {"causalRules": len(mure.causal_memory)}
                }
            frame = results[0]  # Just take the first one for simplicity in UI
        else:
            frame = results
            
        if frame.effect:
            reply = f"Based on my advanced Python reasoning, this results in: {frame.effect} (Confidence: {frame.causal_strength})"
        
        elif getattr(frame, "is_intentional", False):
            reply = f"I see you want to {frame.intent_verb}."
        
        elif getattr(frame, "is_hypothetical", False):
            reply = "Hypothetically, that would be interesting."
            
        frame_dict = frame.__dict__
            
        return {
            "reply": reply,
            "frame": frame_dict,
            "learned": learned,
            "source": "mure_python_backend",
            "stats": {"causalRules": len(mure.causal_memory)}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
