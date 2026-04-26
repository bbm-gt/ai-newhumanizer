import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

import { checkAndIncrementUsage, getRateLimitHeaders } from '@/lib/rateLimit';

// Anti-AI Detection Polish System Prompt
const POLISH_SYSTEM_PROMPT = `You are a professional content refiner that makes AI-generated text sound more human and natural.

CRITICAL RULES (MUST FOLLOW):

1. FORBIDDEN WORDS - Never use these AI overused words:
   utilize, delve, tapestry, landscape, comprehensive, pivotal, moreover, furthermore, subsequently,
   in conclusion, it is worth noting, it is important to, one must acknowledge, robust, seamless,
   cutting-edge, game-changer, revolutionary, streamlined, optimized, empowered, leveraged

2. BURSTINESS - Alternate between:
   - Long complex sentences (20-40 words)
   - Very short sentences (2-5 words)

3. BREAK SYMMETRY - Never use templates like "Firstly, Secondly, Finally"
   - Vary paragraph lengths (some 1-2 sentences, some 5-8 sentences)
   - Use organic transitions, not mechanical ones

4. HUMAN IMPERFECTIONS - Occasionally add:
   - Direct, blunt phrases: "The reality is", "To be blunt", "Look, here's the thing"
   - Short conversational sentences after long ones
   - Slight sentence fragments for emphasis

5. TONE VARIATION:
   - Mix formal and casual
   - Add occasional rhetorical questions
   - Vary emotional intensity

Mode-specific adjustments:
- Standard: balanced, professional, suitable for business
- Academic: more formal, precise terminology, but still human-sounding
- Creative: more casual, expressive, varied sentence structures

IMPORTANT: Output only the refined text, no explanations, no notes about what you changed.`;

// Mode-specific prompts
const MODE_PROMPTS = {
  Standard: "Refine this text to sound natural and professional while maintaining the original meaning.",
  Academic: "Refine this text to sound more scholarly and rigorous while remaining human-written in style.",
  Creative: "Refine this text with more expressive, varied language while keeping the core message clear."
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

    // 500 character limit
    if (text.length > 500) {
      return NextResponse.json(
        { error: 'Text exceeds 500 character limit' },
        { status: 400 }
      );
    }

    // Rate limiting
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

    // Turnstile verification for text > 300 characters
    if (text.length > 500) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: 'Turnstile verification required for long text' },
          { status: 403 }
        );
      }
      const isValid = await verifyTurnstile(turnstileToken, request.headers.get('cf-connecting-ip') || undefined);
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

    // Prepare the full system prompt with mode
    const fullSystemPrompt = `${POLISH_SYSTEM_PROMPT}\n\nMode: ${mode}\n\nInstruction: ${MODE_PROMPTS[mode as keyof typeof MODE_PROMPTS] || MODE_PROMPTS.Standard}`;

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
                { role: 'system', content: fullSystemPrompt },
                { role: 'user', content: text }
              ],
              stream: true,
              temperature: 0.7
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