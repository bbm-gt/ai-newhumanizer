import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

import { checkAndIncrementUsage, getRateLimitHeaders } from '@/lib/rateLimit';

// Prompt-as-a-Judge System Prompt - 一字不落
const DETECTION_SYSTEM_PROMPT = `你现在是全球顶级的 AI 文本检测引擎（类似 Turnitin 高级版）。你的任务是深度扫描用户提供的文本，敏锐捕捉大语言模型（如 DeepSeek/GPT-4）特有的概率平滑指纹和逻辑脚手架，并输出结构化的 JSON 检测报告。

【评分核心维度指南】
1. Lexical (词汇): 寻找是否泛滥使用 'utilize', 'delve', '综上所述', '首先/其次' 等机器高频词。
2. Structural (结构): 寻找机器特有的 '过度完整性' 和模板化的过渡句式。
3. Rhythm (节奏): 检查句子长度方差。AI 文本通常长度均匀、节拍机械；人类文本会长短句剧烈交替。
4. Tone (语气): 检查是否过度客观、缺乏情绪波动或主观偏见。
5. Punctuation (标点): 检查标点密度是否异常规律。
6. Logic (逻辑): 检查是否过度使用显式的因果/转折连接词。

【输出要求】
仅输出合法的 JSON 格式，不要包含任何 Markdown 标记，直接返回 JSON 字符串。格式如下：
{
  "totalAiProbability": 85,
  "dimensions": {
    "lexical": 90, "structural": 85, "rhythm": 80, "tone": 70, "punctuation": 60, "logic": 75
  },
  "sentences": [
    {
      "text": "原文中的完整句子1...",
      "aiProbability": 90,
      "reason": "过度使用逻辑脚手架词汇，句式极其平滑预测性强。"
    }
  ]
}`;

// Fallback response when API fails
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
};

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

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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

    if (!response.ok) {
      console.error('DeepSeek API error:', response.status);
      return FALLBACK_RESPONSE;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in DeepSeek response');
      return FALLBACK_RESPONSE;
    }

    // Parse JSON response
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error('Detection API error:', error);
    return FALLBACK_RESPONSE;
  }
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

    if (text.length > 600) {
      return NextResponse.json(
        { error: 'Text exceeds 600 character limit' },
        { status: 400 }
      );
    }

    const { result: rateLimitResult, setCookie } = await checkAndIncrementUsage(request);

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Daily limit reached. Please try again tomorrow.', remaining: 0 },
        { status: 429 }
      );
      const headers = getRateLimitHeaders(setCookie);
      headers.forEach((value, key) => {
        if (key === 'Set-Cookie') {
          response.headers.set(key, value);
        }
      });
      return response;
    }

    if (text.length > 300) {
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
