import {
  ENGLISH_AI_WORDS,
  CHINESE_AI_PATTERNS,
  AI_TEMPLATES,
  AI_STRUCTURAL_PATTERNS,
} from './aiPhrases';

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

function detectLexical(text: string): { score: number; phrases: string[] } {
  const lowerText = text.toLowerCase();
  const flaggedPhrases: string[] = [];
  let hitCount = 0;

  for (const word of ENGLISH_AI_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(lowerText)) {
      flaggedPhrases.push(word);
      hitCount++;
    }
  }

  for (const pattern of CHINESE_AI_PATTERNS) {
    if (pattern.includes('...')) {
      const parts = pattern.split('...');
      if (parts.length === 2 && lowerText.includes(parts[0]) && lowerText.includes(parts[1])) {
        flaggedPhrases.push(pattern);
        hitCount++;
      }
    } else if (lowerText.includes(pattern)) {
      flaggedPhrases.push(pattern);
      hitCount++;
    }
  }

  const score = Math.min(100, hitCount * 12);
  return { score, phrases: flaggedPhrases };
}

function detectStructural(text: string): { score: number; patterns: string[] } {
  const flaggedPatterns: string[] = [];
  let hitCount = 0;

  for (const pattern of AI_TEMPLATES) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      flaggedPatterns.push(...matches.slice(0, 3));
      hitCount += matches.length;
    }
  }

  for (const pattern of AI_STRUCTURAL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      flaggedPatterns.push(...matches.slice(0, 3));
      hitCount += matches.length;
    }
  }

  const score = Math.min(100, hitCount * 15);
  return { score, patterns: flaggedPatterns };
}

function detectRhythm(text: string): { score: number } {
  const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim());
  if (sentences.length < 3) {
    return { score: 50 };
  }

  const wordCounts = sentences.map(s => s.trim().split(/\s+/).length).filter(n => n > 0);
  if (wordCounts.length < 3) {
    return { score: 50 };
  }

  const mean = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
  const variance = wordCounts.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / wordCounts.length;
  const stdDev = Math.sqrt(variance);

  let aiScore = 50;
  if (stdDev < 3) aiScore += 30;
  else if (stdDev < 5) aiScore += 15;
  else if (stdDev > 10) aiScore -= 20;

  if (mean > 25 && stdDev < 6) aiScore += 15;
  if (mean < 15 && sentences.length > 5) aiScore -= 10;

  return { score: Math.max(0, Math.min(100, aiScore)) };
}

function detectTone(text: string): { score: number } {
  const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim());
  if (sentences.length < 3) {
    return { score: 50 };
  }

  const sentenceLengths = sentences.map(s => s.length);
  const mean = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;

  const longSentences = sentences.filter(s => s.length > mean * 1.3).length;
  const shortSentences = sentences.filter(s => s.length < mean * 0.7).length;

  let toneScore = 50;

  if (sentences.length > 5) {
    const uniformity = Math.abs(longSentences - shortSentences);
    if (uniformity <= 1) toneScore += 25;
    else if (uniformity <= 3) toneScore += 10;
  }

  const questionCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;
  if (questionCount === 0 && exclamationCount === 0 && sentences.length > 5) {
    toneScore += 15;
  }

  return { score: Math.max(0, Math.min(100, toneScore)) };
}

function detectPunctuation(text: string): { score: number } {
  const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim());
  if (sentences.length < 3) {
    return { score: 50 };
  }

  let punctuationScore = 50;

  const commaCount = (text.match(/,/g) || []).length;
  const semicolonCount = (text.match(/;/g) || []).length;
  const colonCount = (text.match(/:/g) || []).length;

  const totalPunctuation = commaCount + semicolonCount + colonCount;
  const words = text.split(/\s+/).length;
  const punctuationRatio = totalPunctuation / words;

  if (punctuationRatio > 0.2) punctuationScore += 20;
  else if (punctuationRatio > 0.15) punctuationScore += 10;
  else if (punctuationRatio < 0.05) punctuationScore += 15;

  const quoteCount = (text.match(/"/g) || []).length;
  if (quoteCount < 2 && text.length > 200) punctuationScore += 10;

  return { score: Math.max(0, Math.min(100, punctuationScore)) };
}

function detectLogic(text: string): { score: number } {
  let logicScore = 50;

  const causationWords = (text.match(/\b(because|therefore|hence|thus|consequently|since|accordingly|thereby)\b/gi) || []).length;
  const contrastWords = (text.match(/\b(however|nevertheless|nonetheless|although|whereas|while|even though)\b/gi) || []).length;

  if (causationWords > 3) logicScore += 10;
  if (contrastWords === 0 && text.length > 200) logicScore += 15;
  if (causationWords > 0 && contrastWords === 0) logicScore += 10;

  const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim());
  const longComplex = sentences.filter(s => s.length > 80).length;
  if (longComplex > sentences.length * 0.5) logicScore += 15;

  return { score: Math.max(0, Math.min(100, logicScore)) };
}

export function detectAI(text: string): DetectionResult {
  const lexical = detectLexical(text);
  const structural = detectStructural(text);
  const rhythm = detectRhythm(text);
  const tone = detectTone(text);
  const punctuation = detectPunctuation(text);
  const logic = detectLogic(text);

  const lexicalWeight = 0.35;
  const structuralWeight = 0.30;
  const rhythmWeight = 0.15;
  const toneWeight = 0.08;
  const punctuationWeight = 0.07;
  const logicWeight = 0.05;

  const weightedSum =
    lexical.score * lexicalWeight +
    structural.score * structuralWeight +
    rhythm.score * rhythmWeight +
    tone.score * toneWeight +
    punctuation.score * punctuationWeight +
    logic.score * logicWeight;

  const aiProbability = Math.round(Math.min(100, Math.max(0, weightedSum)));

  const allFlagged = [
    ...lexical.phrases.slice(0, 5),
    ...structural.patterns.slice(0, 3),
  ];

  return {
    aiProbability,
    lexical: Math.round(lexical.score),
    structural: Math.round(structural.score),
    tone: Math.round(tone.score),
    logic: Math.round(logic.score),
    rhythm: Math.round(rhythm.score),
    punctuation: Math.round(punctuation.score),
    flaggedPhrases: allFlagged,
    flaggedPatterns: structural.patterns.slice(0, 3),
  };
}

// Detect AI with per-sentence analysis for white-box visualization
export function detectAIWithSentences(text: string): {
  overall: DetectionResult;
  sentences: SentenceAnalysis[];
} {
  // Split into sentences (English and Chinese)
  const sentenceRegex = /[^.!?。！？]+[.!?。！？]+/g;
  const matches = text.match(sentenceRegex) || [];
  const sentences: SentenceAnalysis[] = [];

  let charIndex = 0;
  for (let i = 0; i < matches.length; i++) {
    const sentenceText = matches[i];
    const start = text.indexOf(sentenceText, charIndex);
    const end = start + sentenceText.length;
    charIndex = end;

    const reasons: string[] = [];
    let lexicalScore = 0;
    let structuralScore = 0;
    let rhythmScore = 50;
    let toneScore = 50;

    // Check lexical: AI high-frequency words
    const lowerSentence = sentenceText.toLowerCase();
    let aiWordCount = 0;
    for (const word of ENGLISH_AI_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(lowerSentence)) {
        aiWordCount++;
      }
    }
    for (const pattern of CHINESE_AI_PATTERNS) {
      if (pattern.includes('...')) {
        const parts = pattern.split('...');
        if (parts.length === 2 && lowerSentence.includes(parts[0]) && lowerSentence.includes(parts[1])) {
          aiWordCount++;
        }
      } else if (lowerSentence.includes(pattern)) {
        aiWordCount++;
      }
    }
    lexicalScore = Math.min(100, aiWordCount * 25);

    // Check structural: AI templates
    for (const pattern of AI_TEMPLATES) {
      if (pattern.test(sentenceText)) {
        structuralScore = Math.min(100, structuralScore + 30);
        reasons.push('模板化句式');
      }
    }
    for (const pattern of AI_STRUCTURAL_PATTERNS) {
      if (pattern.test(sentenceText)) {
        structuralScore = Math.min(100, structuralScore + 25);
        reasons.push('机械重复结构');
      }
    }

    // Check rhythm: sentence length uniformity
    const wordCount = sentenceText.trim().split(/\s+/).filter(n => n.length > 0).length;
    if (wordCount > 20) {
      rhythmScore = 70;
      reasons.push('长句堆叠');
    } else if (wordCount < 5 && wordCount > 0) {
      rhythmScore = 20;
    }

    // Check tone: uniformity indicators
    const hasUniformStructure = /\b(which|that|because|therefore|however)\b/gi.test(sentenceText);
    if (hasUniformStructure) {
      toneScore = Math.min(100, toneScore + 15);
      reasons.push('过度使用连接词');
    }

    // AI probability for this sentence
    const sentenceAI = Math.round(
      lexicalScore * 0.35 +
      structuralScore * 0.30 +
      rhythmScore * 0.20 +
      toneScore * 0.15
    );

    sentences.push({
      text: sentenceText,
      index: i,
      start,
      end,
      aiProbability: sentenceAI,
      lexical: Math.round(lexicalScore),
      structural: Math.round(structuralScore),
      rhythm: Math.round(rhythmScore),
      tone: Math.round(toneScore),
      reasons: reasons.length > 0 ? reasons : ['无明显AI特征'],
    });
  }

  // Calculate overall
  const overall = detectAI(text);

  return { overall, sentences };
}
