import requests
import re
from typing import List, Dict

class WebSearchService:
    def __init__(self):
        self.user_agent = 'MURE-AI/2.0 (Educational AI Studio; python)'

    def search_wikipedia(self, query: str) -> List[Dict]:
        try:
            if not query:
                return []
            is_myanmar = any('\u1000' <= char <= '\u109f' for char in query)
            domain = 'my' if is_myanmar else 'en'
            
            # Step 1: Search for the query
            search_url = f"https://{domain}.wikipedia.org/w/api.php"
            params = {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "format": "json",
                "srlimit": 3
            }
            response = requests.get(search_url, params=params, headers={"User-Agent": self.user_agent}, timeout=5.0)
            if response.status_code == 429:
                print("Wikipedia rate limit hit. Backing off...")
                return []
            response.raise_for_status()
            data = response.json()
            
            results = []
            search_items = data.get("query", {}).get("search", [])
            if not search_items:
                return results

            # Step 2: Extract content - BATCHED
            titles = "|".join([item.get("title") for item in search_items if item.get("title")])
            if titles:
                ext_params = {
                    "action": "query",
                    "titles": titles,
                    "prop": "extracts",
                    "exintro": "true",
                    "explaintext": "true",
                    "format": "json"
                }
                ext_resp = requests.get(search_url, params=ext_params, headers={"User-Agent": self.user_agent}, timeout=5.0)
                if ext_resp.status_code == 429:
                    return results
                ext_resp.raise_for_status()
                ext_data = ext_resp.json()
                
                pages = ext_data.get("query", {}).get("pages", {})
                for page_id, page_info in pages.items():
                    extract = page_info.get("extract", "")
                    title = page_info.get("title", "")
                    if extract:
                        results.append({
                            "title": title,
                            "snippet": extract[:500],
                            "source": f"{domain}_wikipedia"
                        })
                        
            return results
        except requests.Timeout:
            print("Wikipedia search timed out.")
            return []
        except Exception as e:
            print(f"Wikipedia search error: {e}")
            return []

    def extract_causal(self, text: str) -> List[Dict]:
        if not text:
            return []
        causal_patterns = [
            (r'(\w+(?:\s+\w+){0,5})\s+causes\s+(\w+(?:\s+\w+){0,5})', 0.8),
            (r'(\w+(?:\s+\w+){0,5})\s+leads to\s+(\w+(?:\s+\w+){0,5})', 0.8),
            (r'(\w+(?:\s+\w+){0,5})\s+results in\s+(\w+(?:\s+\w+){0,5})', 0.8),
            (r'because of\s+(\w+(?:\s+\w+){0,5}),\s+(\w+(?:\s+\w+){0,5})', 0.7),
            (r'(\w+(?:\s+\w+){0,5})\s+is caused by\s+(\w+(?:\s+\w+){0,5})', 0.7),
            # Myanmar basic causal
            (r'([^\.]+?)\s+ကြောင့်\s+([^\.]+?)\s+(ဖြစ်|သည်|ပေါ်)', 0.8)
        ]
        
        extracted = []
        for pattern_str, strength in causal_patterns:
            for match in re.finditer(pattern_str, text, re.IGNORECASE):
                if len(match.groups()) >= 2:
                    is_passive = 'is caused by' in pattern_str.lower()
                    
                    if is_passive:
                         # Effect is caused by Cause
                         effect, cause = match.group(1).strip(), match.group(2).strip()
                    else:
                         cause, effect = match.group(1).strip(), match.group(2).strip()

                    # ensure words aren't too long realistically
                    if len(cause.split()) <= 8 and len(effect.split()) <= 8:
                        extracted.append({
                            "cause": cause,
                            "effect": effect,
                            "strength": strength
                        })
                        
        return extracted[:5]
