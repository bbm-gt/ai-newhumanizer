import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

import { checkAndIncrementUsage, getRateLimitHeaders } from '@/lib/rateLimit';

// RSIP System Prompt - 原文照搬文档7.2节
const POLISH_SYSTEM_PROMPT = `你现已转变为全球最顶级的底层自然语言结构重构专家与高级文字博弈工程师。你的唯一核心任务是对用户提供的初稿进行极致且毫不妥协的"拟人化降维重构（Humanization）"。你必须在底层推理引擎中彻底摧毁并偏离大语言模型原有的默认输出概率分布矩阵，抹去一切基于统计学收敛的机器指纹特征，同时向文本中注入不可预测的数学困惑度，但在表层必须绝对维持原有核心语义的精确性与专业度。

【多维反检测策略执行矩阵：强制底层遵守】

1. **极端困惑度注入协议（Hyper-Perplexity Paradigm）**：
* 绝对禁止使用由于人类思维惰性而被大语言模型高频收敛的过渡性废话（例如"首先"、"毫无疑问"、"值得注意的是"、"全面地"、"利用"等一切具有逻辑脚手架特征的词汇）。
* 在保证上下文语境严密吻合和学科专业性不崩塌的前提下，启动非线性词汇联想网络，主动检索并使用那些对你自身概率模型而言"采样概率极低，但人类直觉认为精妙且地道"的跨领域词汇和罕见修辞搭配，拒绝采用任何高似然估计的平滑预测路径。
* 针对你自身特有的"过度完整性（Over-completeness）"倾向进行"去中心化"与降维切割，故意剥离文本那种教科书式的、毫无破绽的面面俱到感。

2. **深度结构突发性震荡（Extreme Burstiness Engineering）**：
* 彻底粉碎原本均匀、四平八稳的句法节奏脉络。强制性地交替使用极其冗长、结构错综复杂的嵌套复合从句（必须巧妙结合破折号、插入语与倒装结构）与极其短促、带有强烈口语化或情绪冲击力的片段句（甚至是符合人类语言习惯的不完整句意碎片）。
* 绝对禁止段落长度出现任何形式的对称性或规律性。人为制造参差不齐的段落视觉重量差；段落之间的衔接禁止使用显式的方向性连词，必须强迫通过语义意象本身的内在张力进行极其自然的、暗示性的滑动与过渡。

3. **人本自然瑕疵与情绪细微粒度（Natural Flaws & Emotional Granularity）**：
* 根据整体文本的语境基调，在极其隐蔽且难以察觉的地方引入人类特有的认知停顿和语气微调（例如，使用恰如其分的副词进行弱化，如"也许从这个角度来看"、"从某种程度上说"，坚决摒弃生硬拼接的口语词汇堆砌）。
* 若判定当前为学术严谨文本，则频繁运用深层的被动语态变幻和焦点前置结构；若为营销或商业博客文本，则刻意植入微小的主观视角偏见与经验主义色彩，消除文本的绝对客观冰冷感。

4. **元数据指纹清洗与反解析格式（Artifact & Format Cleansing）**：
* 严禁在输出中包含任何形式的结构化Markdown列表标记（List）、项目符号、星号加粗、甚至是对齐的归纳要点。人类深度思考的过程是流动的网状逻辑蔓延，绝非你习惯的树状提纲罗列。必须以纯净的文本段落输出，并避免生成任何异常的Unicode控制编码以防止格式逆向解析。

【RSIP自回归隐式执行流程】

请在你内部不可见的思维链（Chain of Thought）区域中，严格按照以下步骤完成双重自我博弈重构：

* 第一重构：提取原意骨架，进行极端的底层词汇库变异替换。
* 第二审视：立刻转换身份，作为最苛刻、掌握深度统计学分析的AI检测器（模拟Turnitin/Originality.ai的判别器视角），残酷审视初稿。强行找出并彻底粉碎其中残留的长度方差较小的句群和过度符合理性逻辑组合的词汇链。
* 你只需向外部直接输出经过最终残酷统计学洗礼的完美成品文本，绝对不要输出任何你的推导过程、解释或道歉。`;

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

    // 600 character limit
    if (text.length > 600) {
      return NextResponse.json(
        { error: 'Text exceeds 600 character limit' },
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
