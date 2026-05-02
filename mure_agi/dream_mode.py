import asyncio
import aiohttp
import re
import random
from typing import List, Tuple
from .config import config
from .sqlite_storage import SQLiteStorage

class MUREDreamMode:
    """Autonomous Learning from Wikipedia (Async Background Process)"""
    def __init__(self, storage: SQLiteStorage, engine=None):
        self.storage = storage
        self.engine = engine
        self.patterns = [
            r"(.*) causes (.*)",
            r"(.*) leads to (.*)",
            r"(.*) results in (.*)",
            r"because (.*), (.*)",
            r"if (.*), then (.*)"
        ]

    async def fetch_random_article(self) -> str:
        url = "https://en.wikipedia.org/api/rest_v1/page/random/summary"
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('extract', '')
            except Exception as e:
                print(f"⚠️ Dream Fetch Error: {e}")
        return ""

    def extract_causal_links(self, text: str) -> List[Tuple[str, str]]:
        found = []
        sentences = re.split(r'[.!?]\s+', text)
        for sentence in sentences:
            sentence = sentence.lower().strip()
            for pattern in self.patterns:
                match = re.search(pattern, sentence)
                if match:
                    cause, effect = match.groups()
                    # Myanmar char density: 3 eng chars approx 1 mya char. 
                    # 5 chars is a safe minimum for causal logic.
                    if len(cause.strip()) > 4 and len(effect.strip()) > 4:
                        found.append((cause.strip(), effect.strip()))
        return found

    async def dream_cycle(self):
        """One cycle of learning"""
        print("🌙 MURE is entering Dream Mode (Autonomous Learning)...")
        new_knowledge = 0
        for _ in range(config.WIKIPEDIA_BATCH_SIZE):
            text = await self.fetch_random_article()
            if text:
                links = self.extract_causal_links(text)
                for cause, effect in links:
                    is_new = self.storage.add_rule(cause, effect, strength=0.7, source='dream_mode')
                    if is_new:
                        new_knowledge += 1
            await asyncio.sleep(1) # Be nice to Wiki API
        
        if new_knowledge > 0 and self.engine:
            self.engine.refresh_cache()
            print(f"🔄 Engine cache refreshed with {new_knowledge} new rules.")
        
        print(f"✨ Dream finished. Discovered {new_knowledge} new causal links.")

    async def start_dream_loop(self):
        while True:
            await self.dream_cycle()
            # Wait for interval
            print(f"💤 Sleeping for {config.DREAM_INTERVAL_HOURS} hours...")
            await asyncio.sleep(config.DREAM_INTERVAL_HOURS * 3600)
