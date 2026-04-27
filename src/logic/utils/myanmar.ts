export class MyanmarProcessor {
  private static myanmarRange = { start: 0x1000, end: 0x109f };

  static isMyanmar(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= this.myanmarRange.start && code <= this.myanmarRange.end) {
        return true;
      }
    }
    return false;
  }

  static normalize(text: string): string {
    // Basic Unicode Normalization (NFC)
    // In Node.js, we can use String.prototype.normalize('NFC')
    return text.normalize('NFC');
  }

  /**
   * Simple Syllable Segmentation for Myanmar
   * Based on standard syllable boundary patterns
   */
  static segment(text: string): string[] {
    if (!text) return [];
    
    // Regex for Myanmar syllables
    // This is a simplified version but effective for basic segmentation
    const syllableRegex = /[\u1000-\u1021\u1023-\u1027\u1029\u102a\u103f\u104c\u104d][\u102b-\u103e]*[\u1039\u103a]?/g;
    const matches = text.match(syllableRegex);
    
    if (!matches) {
      // If no Myanmar syllables found, split by space or character
      return text.split(/\s+/).filter(Boolean);
    }
    
    return matches;
  }

  static cleanQuery(text: string): string {
    // Remove common Burmese stop words or particles if needed for cleaner search
    // For now, just normalize
    return this.normalize(text).trim();
  }
}
