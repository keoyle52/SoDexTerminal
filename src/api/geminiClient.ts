import axios from 'axios';
import { useSettingsStore } from '../store/settingsStore';

export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export async function analyzeSentiment(title: string): Promise<Sentiment> {
  const { geminiApiKey } = useSettingsStore.getState();
  
  if (!geminiApiKey) {
    throw new Error('Gemini API key is not set in Settings.');
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
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 1,
      maxOutputTokens: 10,
    }
  };

  try {
    const res = await axios.post(url, payload);
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toUpperCase();

    if (text?.includes('BULLISH')) return 'BULLISH';
    if (text?.includes('BEARISH')) return 'BEARISH';
    return 'NEUTRAL';
  } catch (err: unknown) {
    console.error('Gemini API Error:', err);
    throw new Error('Failed to analyze sentiment with Gemini AI.');
  }
}
