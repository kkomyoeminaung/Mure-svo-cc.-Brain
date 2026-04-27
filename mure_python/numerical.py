import re

class NumericalHandler:
    def process(self, text: str):
        numbers = re.findall(r'\b\d+(?:\.\d+)?\b', text)
        has_numbers = len(numbers) > 0
        return {
            "has_numbers": has_numbers,
            "numbers": [float(n) for n in numbers] if has_numbers else []
        }
