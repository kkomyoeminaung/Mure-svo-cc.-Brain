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
    const svo = this.extractSVO(sentence);
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
    const words = sentence.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
        if (this.causalVerbs.has(words[i])) {
            return {
                cause: words.slice(0, i).join(' '),
                verb: words[i],
                effect: words.slice(i + 1).join(' ')
            };
        }
    }

    // Myanmar patterns
    if (sentence.includes('ကြောင့်')) {
        const parts = sentence.split('ကြောင့်');
        if (parts.length === 2) {
            return { cause: parts[0].trim(), verb: 'ကြောင့်', effect: parts[1].trim() };
        }
    }

    if (sentence.includes('လို့')) {
        const parts = sentence.split('လို့');
        if (parts.length === 2) {
            return { cause: parts[0].trim(), verb: 'လို့', effect: parts[1].trim() };
        }
    }

    return null;
  }

  private extractSVO(sentence: string): { subject: string; verb: string; object: string } {
    const words = sentence.split(/\s+/);
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
