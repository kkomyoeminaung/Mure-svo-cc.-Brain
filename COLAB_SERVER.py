import threading
import time
from prd_llm.reasoner.mure_ultimate import MUREUltimate
from prd_llm.storage.knowledge_db import KnowledgeDB
from prd_llm.brain.model import PRDLLMBrain
from flask import Flask, request, jsonify

app = Flask(__name__)

# Initialize
mure_ultimate = MUREUltimate()
knowledge_db = KnowledgeDB()
brain = PRDLLMBrain()

# Sync MURE on startup
knowledge_db.sync_with_mure(mure_ultimate.reasoner)

def learn_and_sync(cause, effect):
    mure_ultimate.reasoner.add_rule(cause, effect, 0.9, "automated_learning")
    knowledge_db.add_learning(cause, effect)

def dream_loop():
    while True:
        time.sleep(60) # Dream every minute
        # Simplified dreaming: Try to infer new rules from existing ones
        # Here acting as a placeholder for self-improvement logic
        print("MURE is dreaming and consolidating knowledge...")

# Start background task
threading.Thread(target=dream_loop, daemon=True).start()

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    
    # Mutual Learning: Handle active teaching
    if 'teach_cause' in data and 'teach_effect' in data:
        mure_ultimate.reasoner.add_rule(data['teach_cause'], data['teach_effect'], 0.95, "user_teaching")
        return jsonify({"status": "learned_new_insight"})

    query = data.get('query')
    
    # 1. New Approach: MURE CoT + NLG + Guardrail
    response, metadata = mure_ultimate.respond(query)
    
    return jsonify({"response": response, "source": metadata["source"], "chain": []})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
