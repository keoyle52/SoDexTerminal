import axios from 'axios';
import { useSettingsStore } from '../store/settingsStore';
import { fakeSentimentForHeadline } from './sosoExtraServices';
import { API_BASE } from './backendBase';

const BACKEND_GEMINI = `${API_BASE}/api/gemini`;

export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

/** Detail variant returned by `analyzeSentimentDetailed` so callers can
 *  surface confidence + the model that produced the verdict in the UI. */
export interface SentimentDetail {
  sentiment: Sentiment;
  /** 0..100 — real model output is ~softmax max; demo mode uses 60–80%. */
  confidence: number;
  /** Source of the verdict, useful for the demo "AI" badge. */
  source: 'gemini' | 'demo';
  /** True if the response was served from cache. */
  cached?: boolean;
}

// In-memory sentiment cache. The classification of a fixed headline does
// not drift — a 60-minute TTL is generous and lets the same article
// surface across NewsBot polls + the BtcPredictor news scoring without
// double-billing Gemini. The size cap prevents the map from growing
// unbounded across long sessions; oldest entry is evicted when full.
const _sentimentCache = new Map<string, { sentiment: Sentiment; ts: number; confidence?: number; source?: 'gemini' | 'demo' }>();
const SENTIMENT_CACHE_TTL  = 60 * 60_000;
const SENTIMENT_CACHE_MAX  = 500;

function cacheKey(title: string): string {
  return title.trim().toLowerCase();
}

function evictOldestIfFull(): void {
  if (_sentimentCache.size < SENTIMENT_CACHE_MAX) return;
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const [k, v] of _sentimentCache) {
    if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
  }
  if (oldestKey) _sentimentCache.delete(oldestKey);
}

/** Manually flush the sentiment cache (e.g. on Settings → API key change). */
export function clearSentimentCache(): void {
  _sentimentCache.clear();
}

/**
 * Detailed sentiment classification.
 *
 *  - Demo mode (or no Gemini key): returns a deterministic synthetic verdict
 *    via {@link fakeSentimentForHeadline} so the UI can show "AI sentiment"
 *    without burning API credits. Confidence is constrained to 60–80% so
 *    the band reads like a real softmax output.
 *  - Live mode: calls Gemini 1.5 Flash and parses the single-word reply.
 *    A confidence score is approximated from the response (Gemini does not
 *    expose logits) — we use 75% on a confident BULLISH/BEARISH reply and
 *    55% on NEUTRAL replies as a sane default.
 */
export async function analyzeSentimentDetailed(title: string): Promise<SentimentDetail> {
  const key = cacheKey(title);
  const cached = _sentimentCache.get(key);
  if (cached && Date.now() - cached.ts < SENTIMENT_CACHE_TTL) {
    return {
      sentiment: cached.sentiment,
      confidence: cached.confidence ?? 70,
      source: cached.source ?? 'gemini',
      cached: true,
    };
  }

  const { isDemoMode } = useSettingsStore.getState();

  // Demo fast path — synthesize a deterministic verdict without any network call.
  if (isDemoMode) {
    const fake = fakeSentimentForHeadline(title);
    evictOldestIfFull();
    _sentimentCache.set(key, {
      sentiment: fake.sentiment,
      confidence: fake.confidence,
      source: 'demo',
      ts: Date.now(),
    });
    return { sentiment: fake.sentiment, confidence: fake.confidence, source: 'demo', cached: false };
  }

  // Live path — proxy through our backend which holds the Gemini API key.
  try {
    const res = await axios.post(`${BACKEND_GEMINI}/sentiment`, { title });
    const sentiment: Sentiment =
      res.data?.sentiment === 'BULLISH' ? 'BULLISH' :
      res.data?.sentiment === 'BEARISH' ? 'BEARISH' :
      'NEUTRAL';
    const confidence = sentiment === 'NEUTRAL' ? 55 : 75;

    evictOldestIfFull();
    _sentimentCache.set(key, { sentiment, ts: Date.now(), confidence, source: 'gemini' });
    return { sentiment, confidence, source: 'gemini', cached: false };
  } catch (err: unknown) {
    console.warn('[geminiClient] Backend sentiment call failed, falling back to synth:', err instanceof Error ? err.message : err);
    const fake = fakeSentimentForHeadline(title);
    evictOldestIfFull();
    _sentimentCache.set(key, { sentiment: fake.sentiment, confidence: fake.confidence, source: 'demo', ts: Date.now() });
    return { sentiment: fake.sentiment, confidence: fake.confidence, source: 'demo', cached: false };
  }
}

/**
 * Batch version of sentiment analysis. Checks local cache for each title,
 * and passes the uncached ones in a single batch request to the backend.
 * Synthesizes verdicts in demo mode or on fallback error.
 */
export async function analyzeSentimentBatch(titles: string[]): Promise<SentimentDetail[]> {
  const results = new Map<string, SentimentDetail>();
  const uncachedTitles: string[] = [];

  const { isDemoMode } = useSettingsStore.getState();

  // 1. Resolve cached items and identify uncached ones
  for (const title of titles) {
    const key = cacheKey(title);
    const cached = _sentimentCache.get(key);
    if (cached && Date.now() - cached.ts < SENTIMENT_CACHE_TTL) {
      results.set(title, {
        sentiment: cached.sentiment,
        confidence: cached.confidence ?? 70,
        source: cached.source ?? 'gemini',
        cached: true,
      });
    } else {
      uncachedTitles.push(title);
    }
  }

  // If everything is cached, return immediately
  if (uncachedTitles.length === 0) {
    return titles.map((t) => results.get(t)!);
  }

  // 2. If in demo mode, synthesize for all uncached titles
  if (isDemoMode) {
    for (const title of uncachedTitles) {
      const key = cacheKey(title);
      const fake = fakeSentimentForHeadline(title);
      evictOldestIfFull();
      _sentimentCache.set(key, {
        sentiment: fake.sentiment,
        confidence: fake.confidence,
        source: 'demo',
        ts: Date.now(),
      });
      results.set(title, {
        sentiment: fake.sentiment,
        confidence: fake.confidence,
        source: 'demo',
        cached: false,
      });
    }
    return titles.map((t) => results.get(t)!);
  }

  // 3. Live mode: Call batch backend endpoint
  try {
    const res = await axios.post(`${BACKEND_GEMINI}/sentiment`, { titles: uncachedTitles });
    const sentiments: Sentiment[] = Array.isArray(res.data?.sentiments)
      ? res.data.sentiments
      : uncachedTitles.map(() => 'NEUTRAL');

    for (let i = 0; i < uncachedTitles.length; i++) {
      const title = uncachedTitles[i];
      const sentiment = sentiments[i] || 'NEUTRAL';
      const confidence = sentiment === 'NEUTRAL' ? 55 : 75;
      const key = cacheKey(title);

      evictOldestIfFull();
      _sentimentCache.set(key, { sentiment, ts: Date.now(), confidence, source: 'gemini' });
      results.set(title, { sentiment, confidence, source: 'gemini', cached: false });
    }
  } catch (err) {
    console.warn('[geminiClient] Batch sentiment call failed, falling back to synth:', err);
    // Fallback to synth for uncached
    for (const title of uncachedTitles) {
      const key = cacheKey(title);
      const fake = fakeSentimentForHeadline(title);
      evictOldestIfFull();
      _sentimentCache.set(key, { sentiment: fake.sentiment, confidence: fake.confidence, source: 'demo', ts: Date.now() });
      results.set(title, { sentiment: fake.sentiment, confidence: fake.confidence, source: 'demo', cached: false });
    }
  }

  return titles.map((t) => results.get(t)!);
}

/**
 * Backwards-compatible wrapper — older call sites only need the verdict.
 * Internally delegates to {@link analyzeSentimentDetailed} so the demo /
 * caching behaviour is identical.
 */
export async function analyzeSentiment(title: string): Promise<Sentiment> {
  const detail = await analyzeSentimentDetailed(title);
  return detail.sentiment;
}
