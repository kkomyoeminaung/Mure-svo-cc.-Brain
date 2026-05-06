export interface SVOCCFrame {
  subject?: string;
  verb?: string;
  object?: string;
  complement?: string;
  cause?: string;
  effect?: string;
  causalStrength: number;
  calibratedConfidence?: number;
  questionType?: string;
  isQuestion: boolean;
  rawText: string;
  source?: string;
  isContradiction?: boolean;
  chain?: [string, string, number][];
}

export interface CausalKnowledge {
  cause: string;
  effect: string;
  strength: number;
  confidence: number;
  occurrences: number;
  source: string;
  timestamp: number;
}

export interface ConversationTurn {
  userMessage: string;
  brainResponse: string;
  frame: SVOCCFrame;
  timestamp: number;
}

export interface BrainStats {
  causalRules: number;
  svoFrames: number;
  graphNodes: number;
  graphEdges: number;
  dreamsProcessed: number;
  moralSignature: string;
}
