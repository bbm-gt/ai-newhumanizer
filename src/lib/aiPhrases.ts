// aiPhrases.ts - 已废弃，内容迁移至 DeepSeek LLM 裁判法
// 静态词库和模板已被移除，检测逻辑完全依赖 /api/check 调用 DeepSeek API

export const ENGLISH_AI_WORDS: string[] = [];
export const CHINESE_AI_PATTERNS: string[] = [];
export const AI_TEMPLATES: RegExp[] = [];
export const AI_STRUCTURAL_PATTERNS: RegExp[] = [];

export function hasChinesePattern(text: string, start: string, end: string): boolean {
  return false;
}