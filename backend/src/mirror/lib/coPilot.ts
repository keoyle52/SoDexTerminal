import { GoogleGenAI } from '@google/genai';
import type { SoSoValueClient } from './sosoValueClient';

export interface AICoPilotResult {
  score: number;
  reason: string;
}

export async function auditTradeWithAI(
  trade: { symbol: string; side: string; price: number; quantity: number },
  sosoClient: SoSoValueClient
): Promise<AICoPilotResult> {
  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (!geminiKey) {
    return { score: 15, reason: 'Bypassed AI audit: Gemini API Key is missing.' };
  }

  try {
    const [news, sectors] = await Promise.all([
      sosoClient.getLatestNews(5).catch(() => []),
      sosoClient.getSectorPerformances().catch(() => []),
    ]);

    const newsSummary = news.map((n: any) => `- [${n.sentiment?.toUpperCase() ?? 'NEUTRAL'}] ${n.title}`).join('\n');
    const sectorsSummary = sectors.map((s: any) => `- ${s.sector}: ${s.performance24h}%`).join('\n');

    const prompt = `You are an expert AI Crypto Risk Officer.
Audit the following proposed copy-trade order and determine its risk score (0-100).

PROPOSED COPY-TRADE ORDER:
- Symbol: ${trade.symbol}
- Side: ${trade.side}
- Price: $${trade.price}
- Quantity: ${trade.quantity}
- Total Value: $${(trade.price * trade.quantity).toFixed(2)}

SOSOVALUE MARKET REGIME CONTEXT:
Sector Performances (24h):
${sectorsSummary || 'No sector data available'}

Latest Crypto Hot News & Sentiments:
${newsSummary || 'No news data available'}

Return ONLY a raw JSON object: { "score": number, "reason": string }`;

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const jsonText = response.text?.trim() || '';
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) return { score: 30, reason: 'AI response could not be parsed.' };
    const result = JSON.parse(match[0]) as AICoPilotResult;
    return {
      score: Math.max(0, Math.min(100, result.score ?? 50)),
      reason: result.reason ?? 'AI analysis completed.',
    };
  } catch {
    return { score: 30, reason: 'AI audit encountered a temporary error.' };
  }
}
