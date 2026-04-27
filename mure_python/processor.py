import unicodedata
import re

class MyanmarProcessor:
    @staticmethod
    def is_myanmar(text: str) -> bool:
        for char in text:
            if 0x1000 <= ord(char) <= 0x109F:
                return True
        return False

    @staticmethod
    def normalize(text: str) -> str:
        return unicodedata.normalize('NFC', text)

    @staticmethod
    def segment(text: str) -> list:
        if not text:
            return []
        # Regex for Myanmar syllables
        syllable_regex = r'[\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c\u104d][\u102b-\u103e]*[\u1039\u103a]?'
        matches = re.findall(syllable_regex, text)
        if not matches:
            return text.split()
        return matches
