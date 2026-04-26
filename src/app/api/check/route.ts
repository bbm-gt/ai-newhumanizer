import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

import { checkAndIncrementUsage, getRateLimitHeaders } from '@/lib/rateLimit';
import { detectAI } from '@/lib/detectAI';

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
    const { text, turnstileToken } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (text.length > 500) {
      return NextResponse.json(
        { error: 'Text exceeds 500 character limit' },
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

    const result = detectAI(text);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Check API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
