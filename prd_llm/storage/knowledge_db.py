import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

class KnowledgeDB:
    def __init__(self, storage_path="knowledge_db"):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.storage_path = storage_path
        self.index = faiss.IndexFlatL2(384)
        self.docs = []
        self.load()

    def sync_with_mure(self, mure_engine):
        # Full sync
        self.index = faiss.IndexFlatL2(384)
        self.docs = []
        rules = mure_engine.get_all_rules()
        for rule in rules:
            self.add_learning(rule['cause'], rule['effect'])
        self.save()

    def add_learning(self, cause, effect):
        text = f"{cause} leads to {effect}"
        self.add_chunk(text)

    def add_chunk(self, text):
        embedding = self.model.encode([text])
        self.index.add(np.array(embedding, dtype=np.float32))
        self.docs.append(text)

    def search(self, query):
        if self.index.ntotal == 0:
            return ""
        embedding = self.model.encode([query])
        D, I = self.index.search(np.array(embedding, dtype=np.float32), 1)
        return self.docs[I[0][0]] if I[0][0] != -1 else ""

    def get_context(self, query):
        return self.search(query)

    def save(self):
        import os
        import json
        os.makedirs(self.storage_path, exist_ok=True)
        faiss.write_index(self.index, os.path.join(self.storage_path, "index.faiss"))
        with open(os.path.join(self.storage_path, "docs.json"), "w") as f:
            json.dump(self.docs, f)
        print(f"✅ KnowledgeDB saved: {self.index.ntotal} docs")

    def load(self):
        import os
        import json
        index_path = os.path.join(self.storage_path, "index.faiss")
        docs_path = os.path.join(self.storage_path, "docs.json")
        if os.path.exists(index_path) and os.path.exists(docs_path):
            self.index = faiss.read_index(index_path)
            with open(docs_path, "r") as f:
                self.docs = json.load(f)
            print(f"✅ KnowledgeDB loaded: {self.index.ntotal} docs")
            return True
        return False
