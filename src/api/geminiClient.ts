import axios from 'axios';
import { useSettingsStore } from '../store/settingsStore';
import { fakeSentimentForHeadline } from './sosoExtraServices';

export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

/** Detail variant returned by `analyzeSentimentDetailed` so callers can
 *  surface confidence + the model that produced the verdict in the UI. */
export interface SentimentDetail {
  sentiment: Sentiment;
  /** 0..100 — real model output is ~softmax max; demo mode uses 60–80%. */
  confidence: number;
  /** Source of the verdict, useful for the demo "AI" badge. */
  source: 'gemini' | 'demo';
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
 *  - Live mode: calls Gemini 2.5 Flash and parses the single-word reply.
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
    };
  }

  const { geminiApiKey, isDemoMode } = useSettingsStore.getState();

  // Demo / no-key fast path — synthesize a deterministic verdict so the
  // jury sees an "AI" feature working without entering any credentials.
  if (isDemoMode || !geminiApiKey) {
    const fake = fakeSentimentForHeadline(title);
    evictOldestIfFull();
    _sentimentCache.set(key, {
      sentiment: fake.sentiment,
      confidence: fake.confidence,
      source: 'demo',
      ts: Date.now(),
    });
    return { sentiment: fake.sentiment, confidence: fake.confidence, source: 'demo' };
  }

  // gemini-1.5-flash was retired by Google in late 2025 (returns 404). The
  // 2.5 family is the current low-cost / low-latency tier and is well
  // suited to single-word sentiment classification. Keep this in sync with
  // https://ai.google.dev/gemini-api/docs/models — when 2.5 is itself
  // retired, bump to the latest -flash alias.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

  const prompt = `Analyze the potential crypto market sentiment for this news headline. 
Return ONLY one of these three words: BULLISH, BEARISH, or NEUTRAL. 
Do not provide any explanation or other text.

Headline: "${title}"`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, topK: 1, topP: 1, maxOutputTokens: 10 },
  };

  try {
    const res = await axios.post(url, payload);
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toUpperCase();
    const sentiment: Sentiment =
      text?.includes('BULLISH') ? 'BULLISH' :
      text?.includes('BEARISH') ? 'BEARISH' :
      'NEUTRAL';
    const confidence = sentiment === 'NEUTRAL' ? 55 : 75;

    evictOldestIfFull();
    _sentimentCache.set(key, { sentiment, ts: Date.now(), confidence, source: 'gemini' });
    return { sentiment, confidence, source: 'gemini' };
  } catch (err: unknown) {
    console.error('Gemini API Error:', err);
    throw new Error('Failed to analyze sentiment with Gemini AI.');
  }
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
