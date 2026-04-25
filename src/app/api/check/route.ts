import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// TODO: 需在 Cloudflare Dashboard 中配置 WAF Rate Limiting 规则，限制 /api 每分钟 5 次请求

// AI Detection System Prompt
const CHECK_SYSTEM_PROMPT = `You are a strict AI content detector. Analyze the text and return a JSON object with scores.

Analyze these 6 dimensions (0-100 each):
- lexical: vocabulary fingerprint (AI tends to use "utilize", "comprehensive", "pivotal")
- structural: sentence structure patterns (AI prefers uniform sentence length)
- tone: tonal consistency (AI is often overly neutral)
- logic: logical flow coherence
- rhythm: sentence burstiness (AI has uniform rhythm, humans vary)
- punctuation: punctuation patterns

Return ONLY valid JSON with this exact structure:
{
  "humanScore": integer (0-100),
  "lexical": integer (0-100),
  "structural": integer (0-100),
  "tone": integer (0-100),
  "logic": integer (0-100),
  "rhythm": integer (0-100),
  "punctuation": integer (0-100)
}

Do not add any explanation, markdown, or additional text. Return only the JSON object.`;

// Turnstile verification (placeholder - in production, verify with Cloudflare API)
async function verifyTurnstile(token: string): Promise<boolean> {
  // In Edge Runtime, we would call Cloudflare's Turnstile verification API
  // For now, return true as placeholder
  return token ? true : false;
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

    // Turnstile verification for text > 300 characters
    if (text.length > 300) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: 'Turnstile verification required for long text' },
          { status: 403 }
        );
      }
      const isValid = await verifyTurnstile(turnstileToken);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Turnstile verification failed' },
          { status: 403 }
        );
      }
    }

    // IP rate limiting placeholder
    // In production, implement IP-based rate limiting or use Cloudflare WAF rules

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Call DeepSeek API for AI detection
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: CHECK_SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('DeepSeek API error:', await response.text());
      return NextResponse.json(
        { error: 'AI service temporarily unavailable' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content;

    if (!resultText) {
      return NextResponse.json(
        { error: 'Invalid response from AI service' },
        { status: 502 }
      );
    }

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(resultText.trim());
    } catch {
      // If parsing fails, create a fallback response based on heuristics
      const textLength = text.length;
      const avgWordLength = text.split(/\s+/).reduce((sum, word) => sum + word.length, 0) / text.split(/\s+/).length;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim());
      const avgSentenceLength = sentences.length > 0 ? text.split(/\s+/).length / sentences.length : 0;

      // Heuristic-based fallback
      const aiLikelihood = Math.min(95, Math.max(5,
        (avgWordLength > 5 ? 30 : 0) +
        (avgSentenceLength > 20 ? 20 : 0) +
        (textLength > 1000 ? 15 : 0)
      ));

      result = {
        humanScore: 100 - aiLikelihood,
        lexical: Math.max(10, 100 - aiLikelihood * 1.2),
        structural: Math.max(10, 100 - aiLikelihood),
        tone: Math.max(10, 100 - aiLikelihood * 0.8),
        logic: Math.max(10, 100 - aiLikelihood * 0.7),
        rhythm: Math.max(10, 100 - aiLikelihood * 1.5),
        punctuation: Math.max(10, 100 - aiLikelihood * 0.5)
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Check API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}