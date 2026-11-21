import type { AiErrorCode, GeminiModelId, GeminiModelOption } from '../types';

export const RATE_LIMIT_RETRY_DELAYS_SEC = [5, 15, 30] as const;
export const MAX_RATE_LIMIT_RETRIES = 3;
export const FREE_RATE_LIMIT_MODEL_ORDER: readonly GeminiModelId[] = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
];

export function getNextFreeRateLimitModel(
  currentModel: GeminiModelId,
  availableModels?: GeminiModelOption[]
): GeminiModelId | null {
  const currentMeta = availableModels?.find((m) => m.id === currentModel);
  if (currentMeta?.isFreeTier === false || currentModel === 'gemini-2.5-pro') {
    return null;
  }

  const eligibleFreeOrder = FREE_RATE_LIMIT_MODEL_ORDER.filter((id) => {
    const meta = availableModels?.find((m) => m.id === id);
    return meta ? meta.isFreeTier : true;
  });

  if (eligibleFreeOrder.length === 0) return null;

  const idx = eligibleFreeOrder.indexOf(currentModel);
  if (idx === -1) {
    return eligibleFreeOrder[0];
  }
  return eligibleFreeOrder[(idx + 1) % eligibleFreeOrder.length] ?? null;
}

export class AiClientError extends Error {
  status?: number;
  errorCode: AiErrorCode;
  retryAfterSec?: number;

  constructor(
    message: string,
    options?: { status?: number; errorCode?: AiErrorCode; retryAfterSec?: number }
  ) {
    super(message);
    this.name = 'AiClientError';
    this.status = options?.status;
    this.errorCode = options?.errorCode ?? 'unknown';
    this.retryAfterSec = options?.retryAfterSec;
  }
}

function buildErrorFromPayload(
  status: number | undefined,
  data: Record<string, unknown> | null
): AiClientError {
  const serverMessage = typeof data?.error === 'string' ? data.error : '';
  const errorCode =
    typeof data?.errorCode === 'string' ? (data.errorCode as AiErrorCode) : undefined;
  const retryAfterSec =
    typeof data?.retryAfterSec === 'number' ? data.retryAfterSec : undefined;

  const resolvedStatus =
    status ??
    (errorCode === 'rate_limit' || errorCode === 'quota_exhausted'
      ? 429
      : errorCode === 'overloaded'
        ? 503
        : errorCode === 'not_found'
          ? 404
          : errorCode === 'auth'
            ? 403
            : undefined);

  if (serverMessage && !serverMessage.trim().startsWith('{')) {
    return new AiClientError(serverMessage, {
      status: resolvedStatus,
      errorCode:
        errorCode ??
        (resolvedStatus === 429
          ? 'quota_exhausted'
          : resolvedStatus === 503
            ? 'overloaded'
            : 'unknown'),
      retryAfterSec,
    });
  }

  if (resolvedStatus === 429) {
    return new AiClientError(
      'Gemini API-এর অনুরোধ সীমা বা কোটা পূর্ণ হয়েছে (৪২৯)। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন অথবা অন্য একটি ফ্রি মডেল নির্বাচন করুন।',
      { status: 429, errorCode: errorCode ?? 'quota_exhausted', retryAfterSec }
    );
  }

  if (resolvedStatus === 503) {
    return new AiClientError(
      'এআই সার্ভারে এখন অতিরিক্ত চাপ রয়েছে (৫০৩)। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
      { status: 503, errorCode: 'overloaded' }
    );
  }

  return new AiClientError('এআই সার্ভার থেকে উত্তর আনতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', {
    status: resolvedStatus,
    errorCode: errorCode ?? 'unknown',
  });
}

// Single-user request queue: only 1 Gemini request is allowed in flight at a time
const inFlightJsonRequests = new Map<string, Promise<unknown>>();
const activeStreamUrls = new Set<string>();
let activeGeminiRequests = 0;

export function isGeminiRequestInFlight(): boolean {
  return activeGeminiRequests > 0;
}

const QUEUE_BUSY_MESSAGE =
  'অনুগ্রহ করে অপেক্ষা করুন... একটি Gemini অনুরোধ ইতিমধ্যেই চলছে। (Please wait...)';

const DEFAULT_AI_TIMEOUT_MS = 75_000;
const VIDEO_AI_TIMEOUT_MS = 210_000;

export async function postAiJson<T>(url: string, body: unknown): Promise<T> {
  const dedupeKey = `${url}:${JSON.stringify(body)}`;
  const existing = inFlightJsonRequests.get(dedupeKey) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  if (activeGeminiRequests > 0) {
    throw new AiClientError(QUEUE_BUSY_MESSAGE, { status: 429, errorCode: 'rate_limit' });
  }

  const timeoutMs = url.includes('/video/') ? VIDEO_AI_TIMEOUT_MS : DEFAULT_AI_TIMEOUT_MS;

  activeGeminiRequests += 1;
  const requestPromise = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AiClientError(
          'সার্ভার থেকে উত্তর আসতে নির্ধারিত সময় শেষ হয়ে গেছে (Timeout)। অনুগ্রহ করে আবার চেষ্টা করুন বা অন্য ফ্রি মডেল ব্যবহার করুন।',
          { status: 504, errorCode: 'network' }
        );
      }
      throw new AiClientError(
        'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।',
        { errorCode: 'network' }
      );
    } finally {
      window.clearTimeout(timer);
    }

    let data: Record<string, unknown> | null = null;
    const rawText = await response.text();
    try {
      data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw buildErrorFromPayload(response.status, data);
    }

    if (!data) {
      throw new AiClientError('সার্ভার থেকে সঠিক তথ্য পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।', {
        errorCode: 'unknown',
      });
    }

    return data as T;
  })();

  inFlightJsonRequests.set(dedupeKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightJsonRequests.delete(dedupeKey);
    activeGeminiRequests = Math.max(0, activeGeminiRequests - 1);
  }
}

export interface StreamCallbacks<TDone> {
  onDelta: (text: string) => void;
  onDone: (payload: TDone) => void;
}

export async function streamAiSse<TDone>(
  url: string,
  body: unknown,
  callbacks: StreamCallbacks<TDone>
): Promise<void> {
  if (activeGeminiRequests > 0 || activeStreamUrls.has(url)) {
    throw new AiClientError(QUEUE_BUSY_MESSAGE, { status: 429, errorCode: 'rate_limit' });
  }

  activeGeminiRequests += 1;
  activeStreamUrls.add(url);
  const controller = new AbortController();
  let timeoutId = window.setTimeout(() => controller.abort(), DEFAULT_AI_TIMEOUT_MS);

  const resetActivityTimer = () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => controller.abort(), DEFAULT_AI_TIMEOUT_MS);
  };

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ ...(body as Record<string, unknown>), stream: true }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AiClientError(
          'এআই সার্ভার থেকে উত্তর আসতে নির্ধারিত সময় শেষ হয়েছে (Timeout)। অনুগ্রহ করে আবার চেষ্টা করুন।',
          { status: 504, errorCode: 'network' }
        );
      }
      throw new AiClientError(
        'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।',
        { errorCode: 'network' }
      );
    }

    // Non-streaming JSON response or pre-stream error (e.g., 400 / 429 / 503)
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('application/json')) {
      const rawText = await response.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw buildErrorFromPayload(response.status, data);
      }

      if (data) {
        callbacks.onDone(data as TDone);
        return;
      }
    }

    if (!response.body) {
      throw new AiClientError('স্ট্রিমিং সংযোগ পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।', {
        errorCode: 'network',
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let receivedDone = false;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        resetActivityTimer();
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const dataLines = rawEvent
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());

          if (dataLines.length === 0) continue;
          const jsonText = dataLines.join('\n');

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(jsonText) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (parsed.type === 'delta' && typeof parsed.text === 'string') {
            callbacks.onDelta(parsed.text);
          } else if (parsed.type === 'error') {
            throw buildErrorFromPayload(undefined, parsed);
          } else if (parsed.type === 'done') {
            receivedDone = true;
            callbacks.onDone(parsed as unknown as TDone);
          }
        }
      }
    } catch (err) {
      if (err instanceof AiClientError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AiClientError(
          'উত্তর সম্পূর্ণ হওয়ার আগেই সময় শেষ হয়েছে (Timeout)। অনুগ্রহ করে আবার চেষ্টা করুন।',
          { status: 504, errorCode: 'network' }
        );
      }
      throw new AiClientError('স্ট্রিমিং সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', {
        errorCode: 'network',
      });
    }

    if (!receivedDone) {
      throw new AiClientError('উত্তর অসম্পূর্ণ অবস্থায় সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', {
        errorCode: 'network',
      });
    }
  } finally {
    window.clearTimeout(timeoutId);
    activeStreamUrls.delete(url);
    activeGeminiRequests = Math.max(0, activeGeminiRequests - 1);
  }
}
