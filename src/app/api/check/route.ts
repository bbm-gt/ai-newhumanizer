import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

import { getRequestContext } from '@cloudflare/next-on-pages';
import { checkAndIncrementUsage, getRateLimitHeaders } from '@/lib/rateLimit';

export interface Env {
  AIHUMAN_KV?: {
    get: (key: string, type?: 'json') => Promise<unknown>;
    put: (key: string, value: string, options?: { expirationTtl: number }) => Promise<void>;
  };
}

// DETECTION_SYSTEM_PROMPT - Pure LLM裁判法（废弃正则）
const DETECTION_SYSTEM_PROMPT = `You are an elite AI text detection engine (similar to Originality.ai). Deeply scan the provided text to capture probabilistic smoothing and logical scaffolding typical of LLMs (like DeepSeek/GPT-4).

Evaluate on 6 dimensions (0-100, higher = more likely AI):
1. Lexical: Overuse of AI words (utilize, delve, tapestry, etc.).
2. Structural: Over-completeness, predictable transitions.
3. Rhythm: Lack of variance in sentence length.
4. Tone: Overly objective, lacking human cognitive tangents.
5. Punctuation: Unnatural uniformity.
6. Logic: Excessive explicit conjunctions (furthermore, thus).

Output ONLY a valid JSON object without any Markdown formatting. Format:
{
  "totalAiProbability": 85,
  "dimensions": {"lexical": 90, "structural": 85, "rhythm": 80, "tone": 70, "punctuation": 60, "logic": 75},
  "sentences": [
    {
      "text": "The exact original sentence here...",
      "aiProbability": 90,
      "reason": "Highly predictable transition and overly robotic lexical choices."
    }
  ]
}`;

// Fallback response with error indicator - never crashes frontend
const FALLBACK_RESPONSE = {
  totalAiProbability: 50,
  dimensions: {
    lexical: 50,
    structural: 50,
    rhythm: 50,
    tone: 50,
    punctuation: 50,
    logic: 50,
  },
  sentences: [],
  _fallback: true,
  _error: 'Detection unavailable. Please try again.',
};

// DeepSeek API response types - module level
interface DeepSeekChoice {
  message: { content: string };
}

interface DeepSeekResponse {
  choices: DeepSeekChoice[];
}

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not configured');
    return false;
  }

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip || '',
      }),
    });

    const data = (await result.json()) as TurnstileResponse;
    return data.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

async function callDetectionModel(text: string): Promise<typeof FALLBACK_RESPONSE> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.error('DEEPSEEK_API_KEY is not configured');
    return FALLBACK_RESPONSE;
  }

  let response: Response;
  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: DETECTION_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
  } catch (networkError) {
    console.error('Network error calling DeepSeek API:', networkError);
    return { ...FALLBACK_RESPONSE, _error: 'Network error. Please check your connection.' };
  }

  if (!response.ok) {
    console.error('DeepSeek API error:', response.status);
    return { ...FALLBACK_RESPONSE, _error: `API error: ${response.status}` };
  }

  let data: DeepSeekResponse;
  try {
    data = await response.json() as DeepSeekResponse;
  } catch {
    console.error('Failed to parse JSON response');
    return { ...FALLBACK_RESPONSE, _error: 'Invalid API response format.' };
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    console.error('No content in DeepSeek response');
    return { ...FALLBACK_RESPONSE, _error: 'Empty response from API.' };
  }

  // Safely parse JSON with validation
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error('DeepSeek returned non-JSON content:', content.slice(0, 100));
    return { ...FALLBACK_RESPONSE, _error: 'Malformed JSON from API.' };
  }

  // Validate required fields exist
  const requiredFields = ['totalAiProbability', 'dimensions', 'sentences'];
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      console.error(`Missing required field: ${field}`);
      return { ...FALLBACK_RESPONSE, _error: `Incomplete response: missing ${field}` };
    }
  }

  return parsed as typeof FALLBACK_RESPONSE;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, turnstileToken } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (wordCount > 500) {
      return NextResponse.json(
        { error: 'Text exceeds 500 word limit' },
        { status: 400 }
      );
    }

    // Rate limiting - extract KV binding from Cloudflare context
    let aiHumanKV: Env['AIHUMAN_KV'] | undefined;
    try {
      aiHumanKV = getRequestContext().env.AIHUMAN_KV;
    } catch (e) {
      console.warn('KV context not found, falling back to memory');
    }

    const { result: rateLimitResult, setCookie } = await checkAndIncrementUsage(request, { AIHUMAN_KV: aiHumanKV });

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Daily limit reached. Please try again tomorrow.', remaining: 0 },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
      const headers = getRateLimitHeaders(setCookie);
      headers.forEach((value, key) => {
        if (key === 'Set-Cookie') {
          response.headers.set(key, value);
        }
      });
      return response;
    }

    if (wordCount > 300) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: 'Turnstile verification required for long text' },
          { status: 403 }
        );
      }
      const isValid = await verifyTurnstile(turnstileToken, request.headers.get('CF-Connecting-IP') || undefined);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Turnstile verification failed' },
          { status: 403 }
        );
      }
    }

    // Call the detection model (Prompt-as-a-Judge)
    const result = await callDetectionModel(text);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Check API error:', error);
    return NextResponse.json(FALLBACK_RESPONSE);
  }
}
