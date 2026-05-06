import json
import os
import re
from typing import List, Dict, Optional
from .config import config

class ContextMemory:
    """Manages conversation state and pronoun resolution"""
    def __init__(self, path: str = config.CONTEXT_PATH):
        self.path = path
        self.history: List[Dict] = []
        self.current_topic: Optional[str] = None
        self._load()

    def _load(self):
        if os.path.exists(self.path):
            try:
                with open(self.path, 'r') as f:
                    data = json.load(f)
                    self.history = data.get('history', [])
                    self.current_topic = data.get('current_topic')
            except Exception:
                self.history = []

    def save(self):
        with open(self.path, 'w') as f:
            json.dump({
                "history": self.history[-config.MAX_CONTEXT_HISTORY:],
                "current_topic": self.current_topic
            }, f, indent=2)

    def add_turn(self, user_input: str, system_response: str):
        self.history.append({"user": user_input, "system": system_response})
        # Simple topic extraction (last noun phrase or main subject)
        words = user_input.split()
        if words:
            self.current_topic = words[-1] # Basic fallback
        self.save()

    def resolve_pronouns(self, text: str) -> str:
        """Resolves 'it', 'that', 'this' based on history"""
        pronouns = ["it", "that", "this", "they"]
        text_lower = text.lower()
        
        # Check if text contains any of the pronouns with word boundaries
        has_pronoun = any(re.search(rf"\b{p}\b", text_lower) for p in pronouns)
        if not has_pronoun or not self.history:
            return text
        
        # Replace with topic if available
        if self.current_topic:
            for p in pronouns:
                # Use regex for word boundaries to avoid replacing substrings
                text = re.sub(rf"\b{p}\b", self.current_topic, text, flags=re.IGNORECASE)
        
        return text

    def get_context_summary(self) -> str:
        if not self.history: return ""
        recent = self.history[-2:]
        return " | ".join([f"U: {h['user']} S: {h['system']}" for h in recent])
