const DAILY_LIMIT = 3;
const USER_ID_COOKIE = 'uid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  isNewUser: boolean;
}

export interface Env {
  AIHUMAN_KV?: {
    get: (key: string, type?: 'json') => Promise<unknown>;
    put: (key: string, value: string, options?: { expirationTtl: number }) => Promise<void>;
  };
}

function getOrCreateUserId(request: Request): { userId: string; isNew: boolean } {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${USER_ID_COOKIE}=([^;]*)`));

  if (match && match[1]) {
    return { userId: match[1], isNew: false };
  }

  const newId = crypto.randomUUID();
  return { userId: newId, isNew: true };
}

function createUserIdCookie(userId: string): string {
  const expires = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toUTCString();
  return `${USER_ID_COOKIE}=${userId}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
}

// In-memory fallback store for local development
const memoryStore = new Map<string, number>();

export async function checkAndIncrementUsage(
  request: Request,
  env?: Env
): Promise<{ result: RateLimitResult; userId: string; setCookie?: string }> {
  const { userId, isNew } = getOrCreateUserId(request);
  const today = new Date().toISOString().split('T')[0];
  const kvKey = `usage:${userId}:${today}`;

  let currentCount = 0;

  if (env?.AIHUMAN_KV) {
    const stored = await env.AIHUMAN_KV.get(kvKey, 'json') as number | null;
    currentCount = stored ?? 0;
  } else {
    // Fallback: in-memory Map for local development without KV
    currentCount = memoryStore.get(kvKey) ?? 0;
  }

  if (currentCount >= DAILY_LIMIT) {
    return {
      result: { allowed: false, remaining: 0, isNewUser: isNew },
      userId,
    };
  }

  const newCount = currentCount + 1;

  if (env?.AIHUMAN_KV) {
    await env.AIHUMAN_KV.put(kvKey, JSON.stringify(newCount), {
      expirationTtl: 86400 * 2, // 48 hours
    });
  } else {
    // Fallback: in-memory Map
    memoryStore.set(kvKey, newCount);
  }

  return {
    result: {
      allowed: true,
      remaining: DAILY_LIMIT - newCount,
      isNewUser: isNew,
    },
    userId,
    setCookie: isNew ? createUserIdCookie(userId) : undefined,
  };
}

export function getRateLimitHeaders(setCookie?: string): Headers {
  const headers = new Headers();
  if (setCookie) {
    headers.set('Set-Cookie', setCookie);
  }
  return headers;
}

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  const trimmed = text.trim();
  const segments = trimmed.split(/\s+/);
  let total = 0;
  for (const segment of segments) {
    if (!segment) continue;
    const cjkChars = (segment.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
    const nonCjkPart = segment.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, '');
    if (nonCjkPart.length > 0) {
      const nonCjkWords = nonCjkPart.split(/\s+/).filter(Boolean).length;
      total += cjkChars + nonCjkWords;
    } else {
      total += cjkChars > 0 ? cjkChars : 1;
    }
  }
  return total;
}
