import { GoogleGenAI } from '@google/genai';

export interface WalletReport {
  summary: string;
  riskScore: number;
  riskFactors: string[];
  style: string;
  stats: {
    totalTrades: number;
    winRatePct: number | null;
    avgHoldTimeMinutes: number | null;
    maxLeverageObserved: number | null;
    mostTradedSymbols: string[];
  };
  suggestedCopyConfig: {
    sizingMode: 'fixed' | 'proportional';
    proportionalPct: number;
    maxLeverage: number;
    requireStopLoss: boolean;
    rationale: string;
  };
  performanceEdges: {
    positive: string[];
    negative: string[];
  };
}

export async function analyzeWallet(input: {
  orders: any[]; trades: any[]; positions: any[];
  spotOrders: any[]; spotTrades: any[];
  address: string; accountId: number; network: string;
  apiKey: string;
}): Promise<WalletReport> {
  const { orders, trades, positions, spotOrders, spotTrades, address, accountId, network, apiKey } = input;
  const totalTrades = trades.length + spotTrades.length;

  if (!apiKey) {
    return fallbackReport(trades, positions, totalTrades);
  }

  const prompt = `You are a quantitative trading analyst. Analyze this SoDEX trading account and return a JSON object.

Account: ${address} (ID: ${accountId}, Network: ${network})

Perps Orders (last ${orders.length}): ${JSON.stringify(orders.slice(0, 30))}
Perps Trades (last ${trades.length}): ${JSON.stringify(trades.slice(0, 30))}
Closed Positions (last ${positions.length}): ${JSON.stringify(positions.slice(0, 20))}
Spot Orders (last ${spotOrders.length}): ${JSON.stringify(spotOrders.slice(0, 20))}
Spot Trades (last ${spotTrades.length}): ${JSON.stringify(spotTrades.slice(0, 20))}

Return ONLY a valid JSON object with this exact structure:
{
  "summary": "2-3 sentence trading summary",
  "riskScore": <0-100, higher = riskier>,
  "riskFactors": ["factor1", "factor2"],
  "style": "<scalper|day trader|swing trader|position trader|mixed>",
  "stats": {
    "totalTrades": ${totalTrades},
    "winRatePct": <number or null>,
    "avgHoldTimeMinutes": <number or null>,
    "maxLeverageObserved": <number or null>,
    "mostTradedSymbols": ["SYM1", "SYM2"]
  },
  "suggestedCopyConfig": {
    "sizingMode": "fixed",
    "proportionalPct": 10,
    "maxLeverage": <conservative number>,
    "requireStopLoss": true,
    "rationale": "why these settings"
  },
  "performanceEdges": {
    "positive": ["edge1"],
    "negative": ["leak1"]
  }
}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    const text = result.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackReport(trades, positions, totalTrades);
    return JSON.parse(jsonMatch[0]) as WalletReport;
  } catch {
    return fallbackReport(trades, positions, totalTrades);
  }
}

function fallbackReport(trades: any[], positions: any[], totalTrades: number): WalletReport {
  let wins = 0;
  let maxLev = 1;
  const symbolCounts: Record<string, number> = {};
  for (const p of positions) {
    const pnl = parseFloat(p.closedPnl ?? p.pnl ?? '0');
    if (pnl > 0) wins++;
    const lev = parseFloat(p.leverage ?? '1');
    if (lev > maxLev) maxLev = lev;
  }
  for (const t of trades) {
    const s = t.s ?? t.symbol ?? 'unknown';
    symbolCounts[s] = (symbolCounts[s] ?? 0) + 1;
  }
  const topSymbols = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  const winRate = positions.length > 0 ? Math.round((wins / positions.length) * 100) : null;

  return {
    summary: 'Direct analytics computed from raw trading history (AI analysis unavailable).',
    riskScore: maxLev > 10 ? 75 : maxLev > 5 ? 55 : 35,
    riskFactors: maxLev > 5 ? ['High leverage usage detected'] : [],
    style: 'mixed',
    stats: { totalTrades, winRatePct: winRate, avgHoldTimeMinutes: null, maxLeverageObserved: maxLev, mostTradedSymbols: topSymbols },
    suggestedCopyConfig: { sizingMode: 'fixed', proportionalPct: 10, maxLeverage: Math.min(maxLev, 3), requireStopLoss: true, rationale: 'Conservative defaults based on observed trading patterns.' },
    performanceEdges: { positive: [], negative: [] },
  };
}
