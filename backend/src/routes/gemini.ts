import { Router, Request, Response } from 'express';
import axios from 'axios';
import https from 'https';

const router = Router();
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-1.5-flash';

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

// POST /api/gemini/sentiment
// Body: { title: string } or { titles: string[] }
// Response: { sentiment: 'BULLISH'|'BEARISH'|'NEUTRAL', source: 'gemini' } or { sentiments: string[], source: 'gemini' }
router.post('/sentiment', async (req: Request, res: Response) => {
  const { title, titles } = req.body as { title?: string; titles?: string[] };
  if (!title && (!titles || !Array.isArray(titles) || titles.length === 0)) {
    res.status(400).json({ error: 'title or titles array is required' });
    return;
  }

  const key = apiKey();
  if (!key) {
    res.status(503).json({ error: 'Gemini API key not configured on server' });
    return;
  }

  // Batch headlines request path
  if (titles && Array.isArray(titles) && titles.length > 0) {
    const prompt = `Analyze the crypto market sentiment for each of the following news headlines.
Return a JSON array of strings containing ONLY 'BULLISH', 'BEARISH', or 'NEUTRAL' for each headline in the exact same order.
Do not provide any explanation or markdown formatting. Just return the JSON array.

Headlines:
${titles.map((t, idx) => `${idx + 1}. "${t}"`).join('\n')}`;

    try {
      const response = await axios.post(
        `${GEMINI_BASE}/${MODEL}:generateContent?key=${key}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 200,
            responseMimeType: 'application/json',
          },
        },
        {
          timeout: 10000,
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        },
      );
      const text: string =
        (response.data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined)
          ?.trim() ?? '';
      
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned) as string[];
      if (!Array.isArray(parsed)) {
        throw new Error('Gemini did not return an array');
      }

      const sentiments = parsed.map((s) => {
        const t = String(s).toUpperCase();
        return t.includes('BULLISH') ? 'BULLISH' : t.includes('BEARISH') ? 'BEARISH' : 'NEUTRAL';
      });

      res.json({ sentiments, source: 'gemini' });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status ?? 502;
        const data = err.response?.data || { error: err.message };
        console.error('[gemini/sentiment batch]', err.message, JSON.stringify(data));
        res.status(status).json(data);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[gemini/sentiment batch]', msg);
        res.status(502).json({ error: msg });
      }
    }
    return;
  }

  // Single headline request path
  const prompt = `Analyze the potential crypto market sentiment for this news headline.
Return ONLY one of these three words: BULLISH, BEARISH, or NEUTRAL.
Do not provide any explanation or other text.

Headline: "${title}"`;

  try {
    const response = await axios.post(
      `${GEMINI_BASE}/${MODEL}:generateContent?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, topK: 1, topP: 1, maxOutputTokens: 10 },
      },
      {
        timeout: 8000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      },
    );
    const text: string =
      (response.data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined)
        ?.trim()
        ?.toUpperCase() ?? '';
    const sentiment = text.includes('BULLISH') ? 'BULLISH' : text.includes('BEARISH') ? 'BEARISH' : 'NEUTRAL';
    res.json({ sentiment, source: 'gemini' });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 502;
      const data = err.response?.data || { error: err.message };
      console.error('[gemini/sentiment]', err.message, JSON.stringify(data));
      res.status(status).json(data);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[gemini/sentiment]', msg);
      res.status(502).json({ error: msg });
    }
  }
});

// POST /api/gemini/strategist
// Body: { prompt: string }
// Response: { text: string } — raw Gemini JSON string, parsed by the frontend
router.post('/strategist', async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  const key = apiKey();
  if (!key) {
    res.status(503).json({ error: 'Gemini API key not configured on server' });
    return;
  }

  try {
    const response = await axios.post(
      `${GEMINI_BASE}/${MODEL}:generateContent?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topK: 1,
          topP: 0.9,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
        },
      },
      {
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      },
    );
    const text: string =
      (response.data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined) ?? '';
    res.json({ text });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 502;
      const data = err.response?.data || { error: err.message };
      console.error('[gemini/strategist]', err.message, JSON.stringify(data));
      res.status(status).json(data);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[gemini/strategist]', msg);
      res.status(502).json({ error: msg });
    }
  }
});

export { router as geminiRouter };
