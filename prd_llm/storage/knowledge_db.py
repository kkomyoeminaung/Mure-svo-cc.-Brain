import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

class KnowledgeDB:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.index = faiss.IndexFlatL2(384)
        self.docs = []

    def sync_with_mure(self, mure_engine):
        # Full sync
        self.index = faiss.IndexFlatL2(384)
        self.docs = []
        rules = mure_engine.get_all_rules()
        for rule in rules:
            self.add_learning(rule['cause'], rule['effect'])

    def add_learning(self, cause, effect):
        text = f"{cause} leads to {effect}"
        self.add_chunk(text)

    def add_chunk(self, text):
        embedding = self.model.encode([text])
        self.index.add(np.array(embedding, dtype=np.float32))
        self.docs.append(text)

    def search(self, query):
        embedding = self.model.encode([query])
        D, I = self.index.search(np.array(embedding, dtype=np.float32), 1)
        return self.docs[I[0][0]] if I[0][0] != -1 else ""

    def get_context(self, query):
        return self.search(query)
