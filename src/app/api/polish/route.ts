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

// RSIP System Prompt - 全英文高阶指令，消除翻译腔
const POLISH_SYSTEM_PROMPT = `You are a world-class Computational Linguist. Your ONLY objective is to heavily humanize the user's text, completely obliterating any AI-generated probabilistic signatures.

RULES:
1. Hyper-Perplexity Paradigm: NEVER use typical AI transition scaffolds (e.g., "Furthermore", "Utilize", "Delve"). Force highly unpredicted but contextually brilliant vocabulary.
2. Extreme Burstiness: Violently alternate between extremely long, complex nested clauses (30+ words) and abrupt, punchy emotional fragments (2-5 words).
3. Natural Flaws: Inject subtle human cognitive pauses (e.g., "Perhaps from this angle").
4. Artifact Cleansing: Output pure ASCII paragraphs. NO Markdown, NO lists, NO bolding.

Execute a silent Chain-of-Thought (RSIP Workflow):
- Step 1: Deconstruct syntax and mutate vocabulary.
- Step 2: Self-critique as a harsh Turnitin algorithm, destroying low-variance patterns.
- Step 3: Output ONLY the final perfected text. Do not output your thinking process.`;

// Mode-specific parameters
const MODE_PARAMS = {
  Standard: { temperature: 0.8, topP: 0.9 },
  Academic: { temperature: 0.5, topP: 0.85 },
  Creative: { temperature: 1.3, topP: 0.95 },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, mode = 'Standard', turnstileToken } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // 500 word limit
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
      return NextResponse.json(
        { error: 'Daily limit reached. Please try again tomorrow.', remaining: 0 },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
    }

    // Turnstile verification for text > 300 words
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

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Get mode-specific parameters
    const modeParams = MODE_PARAMS[mode as keyof typeof MODE_PARAMS] || MODE_PARAMS.Standard;

    // Create a streaming response using SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: POLISH_SYSTEM_PROMPT },
                { role: 'user', content: text }
              ],
              stream: true,
              temperature: modeParams.temperature,
              top_p: modeParams.topP,
            })
          });

          if (!response.ok) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI service error' })}\n\n`));
            controller.close();
            return;
          }

          // Process the stream
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } else {
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                    }
                  } catch {
                    // Skip malformed JSON
                  }
                }
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Polish API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
