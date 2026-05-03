import { SVOCCFrame } from './types';
import { MyanmarProcessor } from '../utils/myanmar';

export class SVOCCParser {
  private causalVerbs = new Set([
    'caused', 'cause', 'causes', 'leading to', 'resulted in', 
    'result in', 'results in', 'made', 'makes', 'triggered',
    'ကြောင့်', 'လို့', 'ဖြစ်စေတယ်', 'ဖြစ်လို့'
  ]);

  private questionWords = new Set([
    'what', 'why', 'how', 'when', 'where', 'who', 'which', 'should',
    'ဘာ', 'ဘာလို့', 'ဘယ်လို', 'ဘယ်တော့', 'ဘယ်မှာ', 'ဘယ်သူ'
  ]);

  public parse(sentence: string): SVOCCFrame {
    const normalized = MyanmarProcessor.normalize(sentence);
    const frame: SVOCCFrame = {
      rawText: normalized,
      causalStrength: 0.5,
      isQuestion: false
    };

    const isMyanmar = MyanmarProcessor.isMyanmar(normalized);
    let words: string[];
    
    if (isMyanmar) {
      words = MyanmarProcessor.segment(normalized);
    } else {
      words = normalized.toLowerCase().split(/\s+/);
    }
    
    // Check if question
    if (words.length > 0 && (this.questionWords.has(words[0]) || (isMyanmar && this.questionWords.has(words[words.length - 1])))) {
      frame.isQuestion = true;
      frame.questionType = words[0];
    }

    // Causal pattern extraction
    const causal = this.extractCausal(sentence);
    if (causal) {
      frame.cause = causal.cause;
      frame.verb = causal.verb;
      frame.effect = causal.effect;
      frame.causalStrength = 0.85;
      
      const causeWords = frame.cause.split(/\s+/);
      if (causeWords.length > 0) {
        frame.subject = causeWords[0];
      }
      return frame;
    }

    // SVO pattern extraction (fallback)
    const svo = this.extractSVO(words);
    frame.subject = svo.subject;
    frame.verb = svo.verb;
    frame.object = svo.object;
    
    // Attempt complement (basic heuristic: after verb "is/means/ဖြစ်တယ်")
    const stativeVerbs = new Set([
      'is', 'am', 'are', 'was', 'were', 'be', 'being', 'been',
      'seem', 'seems', 'seemed', 'appear', 'appears', 'appeared',
      'become', 'becomes', 'became', 'remain', 'remains', 'remained',
      'stay', 'stays', 'stayed', 'look', 'looks', 'looked',
      'feel', 'feels', 'felt', 'sound', 'sounds', 'sounded',
      'taste', 'tastes', 'tasted', 'smell', 'smells', 'smelled',
      'ဖြစ်တယ်', 'ဆိုတာ', 'ဖြစ်လာတယ်', 'ဖြစ်လာ', 'means'
    ]);

    if (stativeVerbs.has(svo.verb.toLowerCase())) {
      frame.complement = svo.object;
      frame.object = undefined; // If it's a complement, it shouldn't be an object
    }

    return frame;
  }

  private extractCausal(sentence: string): { cause: string; verb: string; effect: string } | null {
    const isMyanmar = MyanmarProcessor.isMyanmar(sentence);
    
    if (!isMyanmar) {
      const lower = sentence.toLowerCase();
      // Sort multi-word phrases first to prioritize longest match
      const sortedVerbs = Array.from(this.causalVerbs).sort((a, b) => b.length - a.length);
      
      for (const verb of sortedVerbs) {
          // Check for exact phrase surrounded by spaces or boundaries
          const regex = new RegExp(`\\b${verb}\\b`, 'i');
          const match = lower.match(regex);
          if (match && match.index !== undefined) {
              return {
                  cause: sentence.slice(0, match.index).trim(),
                  verb: sentence.slice(match.index, match.index + verb.length).trim(),
                  effect: sentence.slice(match.index + verb.length).trim()
              };
          }
      }
    }

    // Myanmar specific patterns (more common for sentences with no spaces)
    const myanmarParticles = [
      { particle: 'ကြောင့်', fallbackVerb: 'ကြောင့်' },
      { particle: 'လို့', fallbackVerb: 'လို့' },
      { particle: 'ဖြစ်စေတယ်', fallbackVerb: 'ဖြစ်စေတယ်' },
      { particle: 'ဖြစ်လို့', fallbackVerb: 'ဖြစ်လို့' }
    ];

    for (const { particle, fallbackVerb } of myanmarParticles) {
      if (sentence.includes(particle)) {
        const parts = sentence.split(particle);
        if (parts.length >= 2) {
          // If multiple occurrences, we assume the direct cause-effect split is at the last one for "therefore" style
          // or first for "because" style. Most Burmese causal particles are mid-sentence.
          return { 
            cause: parts[0].trim(), 
            verb: fallbackVerb, 
            effect: parts.slice(1).join(particle).trim() 
          };
        }
      }
    }

    return null;
  }

  private extractSVO(words: string[]): { subject: string; verb: string; object: string } {
    const result = { subject: '', verb: '', object: '' };

    if (words.length >= 2) {
      result.subject = words[0];
      result.verb = words[1];
      if (words.length > 2) {
        result.object = words.slice(2).join(' ');
      }
    }

    return result;
  }
}
