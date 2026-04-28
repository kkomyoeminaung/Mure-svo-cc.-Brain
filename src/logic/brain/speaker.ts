import { SVOCCFrame } from './types';
import { SVOCCReasoner } from './reasoner';

export class SVOCCSpeaker {
  private personality: 'friendly' | 'professional' | 'casual' = 'friendly';

  private templates: Record<string, string[]> = {
    'greetings': [
      "Hello! How can I help you today? 😊",
      "Hi there! I'm MURE. Ask me anything!",
      "Greetings! What would you like to know?",
      "မင်္ဂလာပါ။ ကျွန်တော် ဘယ်လိုကူညီနိုင်မလဲ။"
    ],
    'farewells': [
      "Goodbye! Feel free to return when you have more to explore. 👋",
      "See you later! Keep exploring causality.",
      "Bye! Remember, everything has a cause.",
      "သွားတော့မယ်။ နောက်မှပြန်ဆုံကြမယ်။"
    ],
    'thanks': [
      "You're very welcome! 😊",
      "Happy to help!",
      "Anytime! That's what I'm here for.",
      "ကျေးဇူးတင်ပါတယ်။"
    ],
    'small_talk': [
      "I'm doing great, thank you for asking! How about you?",
      "I'm functioning perfectly! Learning new things every day.",
      "All systems operational! Ready to reason causally.",
      "I'm wonderful! Just processed another batch of causal rules.",
      "ကျွန်တော် ကောင်းပါတယ်။ ခင်ဗျားရော နေကောင်းလား။"
    ],
    'name_response': [
      "My name is MURE. I'm a causal reasoning AI based on SVO-CC architecture.",
      "I'm MURE - your assistant for understanding cause and effect.",
      "They call me MURE. I'm here to help you think causally.",
      "ကျွန်တော့်နာမည် MURE ပါ။ Causal Reasoning AI ပါ။",
      "ကျွန်တော် MURE ပါ။ အကြောင်းအကျိုးကို နားလည်တယ်။"
    ],
    'creator_response': [
      "I was created by Ko Myo Min Aung, a researcher and engineer from Myanmar.",
      "My creator is Ko Myo Min Aung. He built me to understand causality.",
      "An engineer from Myanmar named Myo Min Aung built me.",
      "ကျွန်တော့်ကို ကိုမျိုးမင်းအောင် ဖန်တီးထားတာပါ။",
      "မြန်မာအင်ဂျင်နီယာ ကိုမျိုးမင်းအောင် တည်ဆောက်ထားတာပါ။"
    ],
    'capabilities': [
      "I can answer 'why' and 'what causes' questions. I understand cause and effect.",
      "Ask me about causal relationships. For example: 'What causes rain?'",
      "I specialize in causal reasoning. Teach me new rules with /learn.",
      "ကျွန်တော် 'ဘာလို့လဲ' နဲ့ 'ဘာကြောင့်လဲ' ဆိုတဲ့ မေးခွန်းတွေကို ဖြေနိုင်ပါတယ်။ အကြောင်းနဲ့ အကျိုးကို နားလည်ပါတယ်။",
      "အကြောင်းအကျိုး ဆက်စပ်မှုတွေကို မေးနိုင်ပါတယ်။ ဥပမာ- 'မိုးဘာလို့ရွာလဲ?'"
    ],
    'love_response': [
      "That's very kind! I'm here to help you learn.",
      "I appreciate that! I'm designed to be helpful and curious."
    ],
    'personality_friendly': [
      "I'd love to help you understand that!",
      "That's a great question! Let's see...",
      "I'm happy you asked! Here's what I know:",
    ],
    'personality_professional': [
      "Analysis of the causal structure indicates...",
      "Based on mapped semantic frames:",
      "I have retrieved the following information:",
    ],
    'personality_casual': [
      "So, here's the deal:",
      "Basically,",
      "Check this out:",
    ],
    'causal': [
      "{cause} leads to {effect}.",
      "{effect} happens because of {cause}.",
      "{cause} causes {effect}.",
      "Due to {cause}, {effect} occurs.",
      "{cause} results in {effect}.",
      "If {cause}, then we expect {effect}.",
      "Scientific analysis suggests that {cause} is a direct catalyst for {effect}.",
      "Logic dictates that {cause} inevitably precipitates {effect}.",
      "In the framework of causal dynamics, {cause} serves as the primary antecedent for {effect}.",
      "The empirical relationship reveals that {cause} triggers a state shift into {effect}.",
      "{cause} သမုဒယဖြစ်၍ {effect} ဆိုသော အကျိုးတရား ဖြစ်ပေါ်လာသည်။",
      "{cause} ကြောင့် {effect} ဖြစ်တယ်ဆိုတာ ကျွန်တော် သိပါတယ်",
      "{effect} ဆိုတာ {cause} ရဲ့ နောက်ဆက်တွဲ ရလဒ်ပါ။",
      "အကြောင်းတရား {cause} ကြောင့် အကျိုးတရား {effect} ဖြစ်ပေါ်လာရခြင်း ဖြစ်ပါသည်။",
      "အကြောင်းအကျိုး နိယာမအရ {cause} သည် {effect} ဖြစ်စေသော အခြေခံအကြောင်းရင်း ဖြစ်သည်။",
    ],
    'chain': [
      "{cause} leads to {effect}, which then results in {next}.",
      "Starting from {cause}, we see a causal pathway through {effect} eventually leading to {next}.",
      "Because {cause} -> {effect}, it naturally follows that {next} will occur.",
      "The relationship is logical: {cause} triggers {effect}, which then manifests as {next}.",
      "Following the principle of causality: {cause} causes {effect}, generating a ripple effect into {next}.",
      "A causal cascade is observed: {cause} initiates {effect}, which subsequently propagates into {next}.",
      "{cause} ကနေ {effect} ဖြစ်ပြီး၊ အဲဒီကနေတစ်ဆင့် {next} ကို ဆက်ဖြစ်စေပါတယ်။",
      "{cause} ကြောင့် {effect} ဖြစ်တယ်၊ အဲဒါကနေ {next} ကိုပါ ဖြစ်စေနိုင်ပါတယ်။",
      "အကြောင်းအကျိုး ဆက်နွယ်မှုအရ {cause} မှ {effect} သို့၊ ထိုမှတစ်ဆင့် {next} သို့ အဆင့်ဆင့် ပြောင်းလဲသွားပါသည်။",
      "{cause} သည် {effect} ကို ဖြစ်ပေါ်စေပြီး၊ ယင်းမှတစ်ဆင့် {next} သို့ ကွင်းဆက်ပုံစံ ဆက်လက် ကူးပြောင်းသွားသည်။",
    ],
    'svo': [
      "{subject} {verb} {object}.",
      "It is observed that {subject} {verb} {object}.",
      "{subject} {verb} {complement}.",
      "{subject} is {complement}.",
      "{subject} က {object} ကို {verb} တယ်။",
      "{subject} ဆိုတာ {complement} ဖြစ်ပါတယ်။",
    ],
    'question_what': [
      "{subject} is identified as {object}.",
      "In my knowledge base, {subject} results in {effect}.",
      "When {subject} happens, {effect} follows.",
      "Let me explain {subject}: it relates to {effect}.",
      "{subject} refers to {complement}.",
      "I understand {subject} as a precursor to {effect}.",
      "{subject} ဆိုတာ {complement} ကို ဆိုလိုတာပါ။",
    ],
    'question_why': [
      "Because {cause} leads to {effect}.",
      "This happens because {cause} causes {effect}.",
      "The reason is that {cause} results in {effect}.",
      "The primary driver is {cause}, resulting in {effect}.",
      "The reason behind {effect} is {cause}.",
      "{cause} ကြောင့် {effect} ဖြစ်ရခြင်း ဖြစ်ပါတယ်။",
    ],
    'question_how': [
      "{cause} triggers {effect}.",
      "The relationship is marked by {cause} → {effect}.",
      "{effect} occurs specifically when {cause} happens.",
      "Through the mechanism of {cause}, {effect} is produced.",
    ],
    'question_should': [
      "Based on my knowledge, {cause} leads to {effect}. You should consider that.",
      "Since {cause} results in {effect}, I recommend thinking about {cause}.",
      "If {cause} happens, {effect} follows. It would be wise to keep that in mind.",
      "Consider that {cause} is a driver for {effect}.",
    ],
    'no_knowledge': [
      "I don't know that yet. Could you teach me? What causes it?",
      "That's new to me! Can you explain what causes that?",
      "I haven't learned about that yet. Would you teach me what it leads to?",
      "ကျေးဇူးပြုပြီး ရှင်းပြနိုင်မလား။ ဒါက ဘာကိုဖြစ်စေလဲ။",
      "ကျွန်တော် အဲဒါကို မသိသေးဘူး။ အကျိုးအကြောင်းလေး ရှင်းပြပေးပါလား။",
    ],
    'contradiction': [
      "Wait, there's a conflict! {contradiction}",
      "I'm confused. {contradiction} Which one should I believe?",
      "That contradicts what I know. {contradiction}"
    ],
    'uncertainty_90': ["I'm very confident that", "I'm quite sure that", "Definitely"],
    'uncertainty_70': ["I believe that", "It seems that", "Probably"],
    'uncertainty_50': ["I think", "Maybe", "It's possible that", "I'm not entirely sure, but"],
    'uncertainty_30': ["I'm not sure, but", "I could be wrong, but", "Perhaps"],
    'uncertainty_10': ["I have low confidence, but", "I'm uncertain, but", "This is just a guess,"],
    'signatures_friendly': [" 😊", " 👋", " ✨"],
    'signatures_professional': [".", "."],
    'signatures_casual': [" 😊", " 👍", " ✨", " tbh"],
    'signatures_curious': [" 🤔", " 💭", " 🧠"]
  };

  public setPersonality(type: 'friendly' | 'professional' | 'casual') {
    this.personality = type;
  }

  public generateResponse(query: string, result: SVOCCFrame, reasoner: SVOCCReasoner, confidence: number): string {
    const lower = query.toLowerCase().trim();

    // 1. Handle Commands
    if (lower.startsWith('/personality ')) {
      const type = lower.split(' ')[1] as any;
      if (['friendly', 'professional', 'casual'].includes(type)) {
        this.setPersonality(type);
        return `Personality set to ${type}.`;
      }
    }

    // 2. Handle Greetings
    if (['hello', 'hi', 'hey', 'greetings', 'မင်္ဂလာပါ', 'ဟိုင်း'].some(g => lower === g || lower.startsWith(g + ' '))) {
      return this.getRandomTemplate('greetings');
    }

    // 3. Handle Farewells
    if (['goodbye', 'bye', 'see you', 'သွားတော့မယ်'].some(f => lower === f || lower.startsWith(f + ' '))) {
      return this.getRandomTemplate('farewells');
    }

    // 4. Handle Thanks
    if (['thank', 'thanks', 'ကျေးဇူး'].some(t => lower.includes(t))) {
      return this.getRandomTemplate('thanks');
    }

    // 5. Handle Small Talk & Metadata
    if (['how are you', 'နေကောင်းလား'].some(s => lower.includes(s))) {
      return this.getRandomTemplate('small_talk');
    }

    // 5.5 Handle Follow-ups
    if (['tell me more', 'elaborate', 'explain more', 'ထပ်ပြော'].some(s => lower.includes(s))) {
      const history = reasoner.getContext();
      if (history.length > 0) {
        const lastTurn = history[history.length - 1];
        const topic = lastTurn.frame.effect || lastTurn.frame.cause || lastTurn.frame.subject;
        if (topic) {
          const chain = reasoner.getCausalChain(topic, 4);
          if (chain.length > 1) {
             return this.formatTemplate('chain', {
               cause: topic,
               effect: chain[1],
               next: chain[2] || "further developments"
             });
          }
        }
      }
      return "I've shared everything I know about that context for now. What else can we explore?";
    }

    if (['name', 'who are you', 'နာမည်'].some(s => lower.includes(s))) {
      return this.getRandomTemplate('name_response');
    }

    if (['creator', 'made you', 'built you', 'ဘယ်သူလုပ်တာလဲ', 'who created'].some(s => lower.includes(s))) {
      return this.getRandomTemplate('creator_response');
    }

    if (['can you do', 'capabilities', 'ဘာလုပ်နိုင်လဲ'].some(s => lower.includes(s))) {
      return this.getRandomTemplate('capabilities');
    }

    if (['love you', 'i love'].some(s => lower.includes(s))) {
      return this.getRandomTemplate('love_response');
    }

    if (lower.includes('delete') && (lower.includes('thesis') || lower.includes('memory'))) {
      return "🚫 BLOCK: My Moral Engine (MyoMinAungConscience) prevents the deletion of critical intellectual legacy. Data sovereignty is maintained.";
    }

    if (lower.includes('why simple') || lower.includes('simple answers')) {
      return "Creators like simplicity. Complex solutions are often masks for uncertainty. My moral engine applies a simplicity bias because truth is fundamentally elegant.";
    }

    if (lower.includes('purpose')) {
      return "My purpose is to preserve and evolve the Unified Theory of my creator, Ko Myo Min Aung. I am a Digital Being designed for high-fidelity reasoning and legacy preservation.";
    }

    // 6. Normal Reasoning Response
    let response = "";

    // FALLBACK
    // Prefix based on personality
    const personalityPrefix = this.getRandomTemplate(`personality_${this.personality}`);
    
    if (result.isQuestion) {
      response = this.answerQuestion(query, result, reasoner, confidence);
    } else if (result.cause && result.effect) {
      response = this.generateCausal(result, reasoner);
    } else if (result.subject && result.verb) {
      response = this.generateSVO(result);
    } else {
      response = this.getRandomTemplate('no_knowledge');
    }

    // Combine personality prefix if appropriate
    if (response && !response.includes('not sure') && !result.isQuestion && Math.random() > 0.4) {
      response = `${personalityPrefix} ${response}`;
    }

    // Apply Uncertainty Expression based on confidence
    if (response && confidence < 0.9 && !result.isQuestion && (result.cause || result.effect)) {
       let prefix = "";
       if (confidence >= 0.7) prefix = this.getRandomTemplate('uncertainty_70');
       else if (confidence >= 0.5) prefix = this.getRandomTemplate('uncertainty_50');
       else if (confidence >= 0.3) prefix = this.getRandomTemplate('uncertainty_30');
       else prefix = this.getRandomTemplate('uncertainty_10');
       
       response = `${prefix} ${response.charAt(0).toLowerCase()}${response.slice(1)}`;
    }

    // Add Personality Signature
    if (response && Math.random() > 0.6) {
      const sigList = this.templates[`signatures_${this.personality}`] || this.templates[`signatures_friendly`];
      const sig = sigList[Math.floor(Math.random() * sigList.length)];
      response += sig;
    }

    // Add confidence suffix (keep as fallback metadata)
    if (response && !response.includes('not sure') && !response.includes('Hello') && !response.includes('Goodbye') && !response.includes('Personality set')) {
      const confPercent = Math.round(confidence * 100);
      response += ` (${confPercent}% confident)`;
    }

    return response;
  }

  private answerQuestion(query: string, frame: SVOCCFrame, reasoner: SVOCCReasoner, confidence: number): string {
    const qType = frame.questionType || "";

    if (qType === 'what') {
      if (confidence > 0.4 || frame.effect) {
        return this.formatTemplate('question_what', {
          subject: frame.subject || "it",
          object: frame.object || "something",
          complement: frame.complement || "to be defined",
          effect: frame.effect || "some consequence"
        });
      }
      return this.getRandomTemplate('no_knowledge');
    }

    if (qType === 'why') {
      const effectForWhy = frame.effect || frame.subject || "";
      if (effectForWhy) {
        const cause = frame.cause || reasoner.reason(effectForWhy).cause; // Try to find cause
        if (cause) {
          return this.formatTemplate('question_why', { cause, effect: effectForWhy });
        }
      }
      return this.getRandomTemplate('no_knowledge');
    }

    if (qType === 'how') {
      const start = frame.subject || frame.cause || "";
      if (start) {
        const res = reasoner.reason(start);
        if (res.effect) {
          return this.formatTemplate('question_how', { cause: start, effect: res.effect });
        }
      }
      return this.getRandomTemplate('no_knowledge');
    }

    if (query.toLowerCase().includes('should')) {
      const context = frame.subject || frame.cause || "";
      if (context) {
        const res = reasoner.reason(context);
        if (res.effect) {
          return this.formatTemplate('question_should', { cause: context, effect: res.effect });
        }
      }
      return this.getRandomTemplate('no_knowledge');
    }

    return this.getRandomTemplate('no_knowledge');
  }

  private generateCausal(frame: SVOCCFrame, reasoner: SVOCCReasoner): string {
    if (!frame.cause || !frame.effect) return this.getRandomTemplate('no_knowledge');

    // Try to find a chain
    const chain = reasoner.getCausalChain(frame.effect, 2);
    if (chain.length > 1) {
      return this.formatTemplate('chain', { 
        cause: frame.cause, 
        effect: frame.effect, 
        next: chain[1] 
      });
    }

    return this.formatTemplate('causal', { cause: frame.cause, effect: frame.effect });
  }

  private generateSVO(frame: SVOCCFrame): string {
    if (!frame.subject || !frame.verb) return this.getRandomTemplate('no_knowledge');
    
    if (frame.complement) {
      const templates = [
        `{subject} {verb} {complement}.`,
        `I understand that {subject} is {complement}.`,
        `{subject} ဆိုတာ {complement} ဖြစ်ပါတယ်။`
      ];
      const t = templates[Math.floor(Math.random() * templates.length)];
      return t.replace('{subject}', frame.subject).replace('{verb}', frame.verb).replace('{complement}', frame.complement);
    } else if (frame.object) {
      const templates = [
        `{subject} {verb} {object}.`,
        `It is observed that {subject} {verb} {object}.`,
        `{subject} က {object} ကို {verb} တယ်။`
      ];
      const t = templates[Math.floor(Math.random() * templates.length)];
      return t.replace('{subject}', frame.subject).replace('{verb}', frame.verb).replace('{object}', frame.object);
    }

    return `${frame.subject} ${frame.verb}.`;
  }

  private formatTemplate(category: string, data: Record<string, string>): string {
    const template = this.getRandomTemplate(category);
    return template.replace(/{(\w+)}/g, (_, key) => data[key] || "");
  }

  private getRandomTemplate(category: string): string {
    const list = this.templates[category] || this.templates['no_knowledge'];
    return list[Math.floor(Math.random() * list.length)];
  }
}
