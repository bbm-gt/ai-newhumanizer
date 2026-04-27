// detectAI.ts - 已废弃，检测逻辑已迁移至 /api/check/route.ts 的纯 LLM 裁判法
// 基于正则的 detectAI() 和 detectAIWithSentences() 不再使用

export interface DetectionResult {
  aiProbability: number;
  lexical: number;
  structural: number;
  tone: number;
  logic: number;
  rhythm: number;
  punctuation: number;
  flaggedPhrases: string[];
  flaggedPatterns: string[];
}

export interface SentenceAnalysis {
  text: string;
  index: number;
  start: number;
  end: number;
  aiProbability: number;
  lexical: number;
  structural: number;
  rhythm: number;
  tone: number;
  reasons: string[];
}

// DEPRECATED: 使用 /api/check 通过 DeepSeek LLM 进行检测
export function detectAI(text: string): DetectionResult {
  return {
    aiProbability: 0,
    lexical: 0,
    structural: 0,
    tone: 0,
    logic: 0,
    rhythm: 0,
    punctuation: 0,
    flaggedPhrases: [],
    flaggedPatterns: [],
  };
}

// DEPRECATED
export function detectAIWithSentences(text: string): {
  overall: DetectionResult;
  sentences: SentenceAnalysis[];
} {
  return {
    overall: detectAI(text),
    sentences: [],
  };
}