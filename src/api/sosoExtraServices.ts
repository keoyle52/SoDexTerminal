// ─── SoSoValue extra endpoints + demo synthesis ───────────────────────────
// Covers the OpenAPI v1 endpoints used by the new pages:
//   • /macro/events                     — macroeconomic calendar
//   • /indices                          — SSI index list / constituents / klines
//   • /btc-treasuries                   — corporate BTC treasury list + history
//   • /fundraising/projects             — recent VC funding rounds
//   • /currencies/sector-spotlight      — sector & spotlight performance
//   • /crypto-stocks                    — MSTR / COIN / MARA / etc. snapshots
//
// Every helper is wired to fall back to deterministic synthetic data when
// (a) demo mode is active, or (b) the API key is missing, or (c) the
// network call fails. This keeps the new pages explorable for jury-grade
// demos without burning the 20 req/min SoSoValue quota.

import { sosoValueClient } from './sosoValueClient';
import { useSettingsStore } from '../store/settingsStore';

// ─── Common helpers ───────────────────────────────────────────────────────

function isDemo(): boolean {
  return useSettingsStore.getState().isDemoMode;
}

function hasSosoKey(): boolean {
  return !!useSettingsStore.getState().sosoApiKey;
}

/**
 * 32-bit FNV-1a hash. Used to derive stable pseudo-random sequences from
 * a string seed (e.g. a headline) so the same input always produces the
 * same demo output across page reloads.
 */
function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG seeded from a 32-bit integer; returns 0..1 floats. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Macro Events ─────────────────────────────────────────────────────────

export type MacroImpact = 'High' | 'Medium' | 'Low';

export interface MacroEvent {
  date: string;         // YYYY-MM-DD
  events: string[];     // event names
  /** Synthesized when the API does not include impact data. */
  impacts?: MacroImpact[];
}

/**
 * Catalog of recurring macro events with their typical BTC-impact tier.
 * Used both to label real API responses and to seed the demo calendar.
 */
const MACRO_EVENT_CATALOG: { name: string; impact: MacroImpact; weekday?: number; monthDay?: number }[] = [
  { name: 'FOMC Rate Decision',      impact: 'High',   monthDay: 18 },
  { name: 'FOMC Meeting Minutes',    impact: 'High',   monthDay: 22 },
  { name: 'Fed Chair Press Conf.',   impact: 'High',   monthDay: 18 },
  { name: 'CPI (YoY)',               impact: 'High',   monthDay: 12 },
  { name: 'Core CPI (MoM)',          impact: 'High',   monthDay: 12 },
  { name: 'PPI (MoM)',               impact: 'Medium', monthDay: 14 },
  { name: 'PCE Price Index',         impact: 'High',   monthDay: 28 },
  { name: 'Nonfarm Payrolls',        impact: 'High',   weekday: 5 }, // first Friday
  { name: 'Unemployment Rate',       impact: 'High',   weekday: 5 },
  { name: 'ADP Employment',          impact: 'Medium', weekday: 3 },
  { name: 'Initial Jobless Claims',  impact: 'Low',    weekday: 4 },
  { name: 'Retail Sales',            impact: 'Medium', monthDay: 16 },
  { name: 'GDP (QoQ Adv.)',          impact: 'High',   monthDay: 26 },
  { name: 'ISM Manufacturing PMI',   impact: 'Medium', monthDay: 1  },
  { name: 'ISM Services PMI',        impact: 'Medium', monthDay: 3  },
  { name: 'Consumer Confidence',     impact: 'Low',    monthDay: 25 },
  { name: 'Powell Testimony',        impact: 'High',   monthDay: 7  },
  { name: 'ECB Rate Decision',       impact: 'Medium', monthDay: 11 },
  { name: 'BoJ Rate Decision',       impact: 'Medium', monthDay: 19 },
  { name: 'Treasury Bond Auction',   impact: 'Low',    weekday: 2  },
];

/** Heuristic mapping from a free-text event name → BTC-impact tier. */
export function classifyMacroImpact(name: string): MacroImpact {
  const upper = name.toUpperCase();
  if (/FOMC|RATE DECISION|POWELL|FED CHAIR|CPI|PCE|NONFARM|JOBS REPORT|GDP/.test(upper)) return 'High';
  if (/PPI|RETAIL SALES|UNEMPLOYMENT|ISM|ECB|BOJ|TESTIMONY|MINUTES|ADP/.test(upper)) return 'Medium';
  return 'Low';
}

function generateDemoMacroEvents(daysAhead = 30): MacroEvent[] {
  const out: MacroEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seed = hashSeed(`macro-${today.toISOString().slice(0, 10)}`);
  const rng = mulberry32(seed);

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const isoDate = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay(); // 0=Sun ... 6=Sat
    const dayOfMonth = d.getDate();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    const dayEvents: string[] = [];
    const dayImpacts: MacroImpact[] = [];
    for (const c of MACRO_EVENT_CATALOG) {
      let matches = false;
      if (c.weekday != null && c.weekday === dayOfWeek) matches = rng() > 0.55;
      if (c.monthDay != null && Math.abs(c.monthDay - dayOfMonth) <= 1) matches = rng() > 0.40;
      // small chance of wildcard event so calendar isn't sparse
      if (!matches && rng() > 0.93) matches = true;
      if (matches) {
        dayEvents.push(c.name);
        dayImpacts.push(c.impact);
      }
    }
    if (dayEvents.length > 0) {
      out.push({ date: isoDate, events: dayEvents, impacts: dayImpacts });
    }
  }
  return out;
}

/**
 * Fetch upcoming macro events. Shape: array of `{ date, events[], impacts[] }`.
 * Uses the live API when keys are present; otherwise returns deterministic
 * demo data so the calendar page is always populated.
 */
export async function fetchMacroEvents(daysAhead = 30): Promise<MacroEvent[]> {
  if (isDemo() || !hasSosoKey()) {
    return generateDemoMacroEvents(daysAhead);
  }
  try {
    const res = await sosoValueClient.get('/openapi/v1/macro/events') as {
      data?: unknown; code?: number; msg?: string;
    } | unknown[];
    const raw = Array.isArray(res) ? res : ((res as { data?: unknown })?.data ?? []);
    const arr = Array.isArray(raw) ? raw : [];
    const mapped = arr.map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const events = Array.isArray(r.events) ? (r.events as unknown[]).map((e) => String(e)) : [];
      return {
        date: String(r.date ?? ''),
        events,
        impacts: events.map(classifyMacroImpact),
      } satisfies MacroEvent;
    }).filter((m) => m.date && m.events.length > 0);
    return mapped.length > 0 ? mapped : generateDemoMacroEvents(daysAhead);
  } catch {
    return generateDemoMacroEvents(daysAhead);
  }
}

// ─── SSI Indices ──────────────────────────────────────────────────────────

export interface SsiIndexConstituent {
  currencyId: string;
  symbol: string;
  weight: number; // 0..1
}

export interface SsiIndexSnapshot {
  ticker: string;
  /** Latest demo or live price. */
  price: number;
  change24h: number; // %
  marketCap: number;
  description: string;
  constituents: SsiIndexConstituent[];
  klines: { timestamp: number; open: number; high: number; low: number; close: number }[];
}

const DEMO_SSI_BUNDLES: { ticker: string; description: string; constituents: { symbol: string; weight: number }[]; basePrice: number }[] = [
  {
    ticker: 'ssimag7',
    description: 'Magnificent 7 — top crypto majors weighted by market cap.',
    basePrice: 0.523,
    constituents: [
      { symbol: 'btc', weight: 0.42 },
      { symbol: 'eth', weight: 0.22 },
      { symbol: 'sol', weight: 0.10 },
      { symbol: 'bnb', weight: 0.08 },
      { symbol: 'xrp', weight: 0.07 },
      { symbol: 'ada', weight: 0.06 },
      { symbol: 'doge', weight: 0.05 },
    ],
  },
  {
    ticker: 'ssidefi',
    description: 'DeFi blue chips — leading DEX, lending and derivatives protocols.',
    basePrice: 0.322,
    constituents: [
      { symbol: 'uni',    weight: 0.20 },
      { symbol: 'aave',   weight: 0.18 },
      { symbol: 'mkr',    weight: 0.14 },
      { symbol: 'crv',    weight: 0.12 },
      { symbol: 'ldo',    weight: 0.12 },
      { symbol: 'sushi',  weight: 0.08 },
      { symbol: 'comp',   weight: 0.08 },
      { symbol: 'pendle', weight: 0.08 },
    ],
  },
  {
    ticker: 'ssimeme',
    description: 'Meme basket — the most-traded cultural meme tokens.',
    basePrice: 0.232,
    constituents: [
      { symbol: 'doge', weight: 0.30 },
      { symbol: 'shib', weight: 0.22 },
      { symbol: 'pepe', weight: 0.18 },
      { symbol: 'wif',  weight: 0.10 },
      { symbol: 'bonk', weight: 0.08 },
      { symbol: 'floki',weight: 0.07 },
      { symbol: 'mog',  weight: 0.05 },
    ],
  },
  {
    ticker: 'ssilayer1',
    description: 'Layer 1 basket — major monolithic L1 chains.',
    basePrice: 0.918,
    constituents: [
      { symbol: 'eth',  weight: 0.34 },
      { symbol: 'sol',  weight: 0.18 },
      { symbol: 'bnb',  weight: 0.14 },
      { symbol: 'avax', weight: 0.10 },
      { symbol: 'apt',  weight: 0.08 },
      { symbol: 'sui',  weight: 0.08 },
      { symbol: 'near', weight: 0.08 },
    ],
  },
  {
    ticker: 'ssiai',
    description: 'AI tokens — compute marketplaces and on-chain inference networks.',
    basePrice: 0.412,
    constituents: [
      { symbol: 'tao',   weight: 0.28 },
      { symbol: 'rndr',  weight: 0.18 },
      { symbol: 'fet',   weight: 0.16 },
      { symbol: 'agix',  weight: 0.12 },
      { symbol: 'akt',   weight: 0.10 },
      { symbol: 'ocean', weight: 0.08 },
      { symbol: 'wld',   weight: 0.08 },
    ],
  },
];

function generateDemoKlines(seed: number, basePrice: number, count = 90): { timestamp: number; open: number; high: number; low: number; close: number }[] {
  const rng = mulberry32(seed);
  const out: { timestamp: number; open: number; high: number; low: number; close: number }[] = [];
  const dayMs = 86_400_000;
  let price = basePrice * (0.85 + rng() * 0.2);
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const drift = (rng() - 0.48) * 0.04;
    const close = Math.max(0.0001, open * (1 + drift));
    const high = Math.max(open, close) * (1 + rng() * 0.018);
    const low  = Math.min(open, close) * (1 - rng() * 0.018);
    out.push({
      timestamp: now - i * dayMs,
      open: +open.toFixed(6),
      high: +high.toFixed(6),
      low:  +low.toFixed(6),
      close:+close.toFixed(6),
    });
    price = close;
  }
  return out;
}

function generateDemoSsiSnapshot(ticker: string): SsiIndexSnapshot | null {
  const bundle = DEMO_SSI_BUNDLES.find((b) => b.ticker === ticker.toLowerCase());
  if (!bundle) return null;
  const seed = hashSeed(`ssi-${bundle.ticker}-${new Date().toISOString().slice(0, 10)}`);
  const klines = generateDemoKlines(seed, bundle.basePrice, 90);
  const last  = klines[klines.length - 1].close;
  const prev  = klines[klines.length - 2]?.close ?? last;
  const change24h = ((last - prev) / prev) * 100;
  return {
    ticker: bundle.ticker,
    price: last,
    change24h,
    marketCap: last * 250_000_000 * bundle.constituents.length,
    description: bundle.description,
    constituents: bundle.constituents.map((c) => ({
      currencyId: `demo-${c.symbol}`,
      symbol: c.symbol,
      weight: c.weight,
    })),
    klines,
  };
}

/** List the available SSI tickers. */
export async function fetchSsiIndexList(): Promise<string[]> {
  if (isDemo() || !hasSosoKey()) {
    return DEMO_SSI_BUNDLES.map((b) => b.ticker);
  }
  try {
    const res = await sosoValueClient.get('/openapi/v1/indices') as { data?: unknown } | unknown[];
    const raw = Array.isArray(res) ? res : ((res as { data?: unknown })?.data ?? []);
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((v) => String(v));
    }
    return DEMO_SSI_BUNDLES.map((b) => b.ticker);
  } catch {
    return DEMO_SSI_BUNDLES.map((b) => b.ticker);
  }
}

/** Full snapshot for one index (constituents + 90-day klines). */
export async function fetchSsiIndexSnapshot(ticker: string): Promise<SsiIndexSnapshot | null> {
  if (isDemo() || !hasSosoKey()) {
    return generateDemoSsiSnapshot(ticker);
  }
  try {
    const [constRes, klinesRes] = await Promise.all([
      sosoValueClient.get(`/openapi/v1/indices/${encodeURIComponent(ticker)}/constituents`),
      sosoValueClient.get(`/openapi/v1/indices/${encodeURIComponent(ticker)}/klines?interval=1d&limit=90`),
    ]);
    const cRaw = Array.isArray(constRes) ? constRes : (((constRes as { data?: unknown })?.data) ?? []);
    const kRaw = Array.isArray(klinesRes) ? klinesRes : (((klinesRes as { data?: unknown })?.data) ?? []);
    const constituents = (Array.isArray(cRaw) ? cRaw : []).map((c) => {
      const r = c as Record<string, unknown>;
      return {
        currencyId: String(r.currency_id ?? r.currencyId ?? ''),
        symbol: String(r.symbol ?? '').toLowerCase(),
        weight: Number(r.weight ?? 0),
      };
    });
    const klines = (Array.isArray(kRaw) ? kRaw : []).map((k) => {
      const r = k as Record<string, unknown>;
      return {
        timestamp: Number(r.timestamp ?? 0),
        open:  Number(r.open  ?? 0),
        high:  Number(r.high  ?? 0),
        low:   Number(r.low   ?? 0),
        close: Number(r.close ?? 0),
      };
    });
    if (constituents.length === 0 || klines.length === 0) {
      return generateDemoSsiSnapshot(ticker);
    }
    const last = klines[klines.length - 1].close;
    const prev = klines[klines.length - 2]?.close ?? last;
    return {
      ticker,
      price: last,
      change24h: prev > 0 ? ((last - prev) / prev) * 100 : 0,
      marketCap: last * 250_000_000 * constituents.length,
      description: '',
      constituents,
      klines,
    };
  } catch {
    return generateDemoSsiSnapshot(ticker);
  }
}

// ─── BTC Treasuries ───────────────────────────────────────────────────────

export interface BtcTreasuryCompany {
  ticker: string;
  name: string;
  listLocation: string;
}

export interface BtcPurchaseRow {
  date: string;          // YYYY-MM-DD
  ticker: string;
  btcHolding: number;
  btcAcq: number;
  acqCost: number;       // USD
  avgBtcCost: number;    // USD per BTC
}

const DEMO_TREASURY_COMPANIES: { ticker: string; name: string; listLocation: string; baseHolding: number; cadenceDays: number; minBuy: number; maxBuy: number }[] = [
  { ticker: 'MSTR',  name: 'MicroStrategy',     listLocation: 'US', baseHolding: 252_000, cadenceDays: 12, minBuy: 1500, maxBuy: 6000 },
  { ticker: 'TSLA',  name: 'Tesla',             listLocation: 'US', baseHolding:  11_500, cadenceDays: 90, minBuy:  200, maxBuy: 1500 },
  { ticker: 'MARA',  name: 'Marathon Digital',  listLocation: 'US', baseHolding:  26_700, cadenceDays:  9, minBuy:  150, maxBuy:  900 },
  { ticker: 'RIOT',  name: 'Riot Platforms',    listLocation: 'US', baseHolding:  16_400, cadenceDays: 14, minBuy:  100, maxBuy:  600 },
  { ticker: 'COIN',  name: 'Coinbase Global',   listLocation: 'US', baseHolding:   9_500, cadenceDays: 60, minBuy:   80, maxBuy:  500 },
  { ticker: 'SQ',    name: 'Block, Inc.',       listLocation: 'US', baseHolding:   8_100, cadenceDays: 45, minBuy:   60, maxBuy:  400 },
  { ticker: '3350',  name: 'Metaplanet',        listLocation: 'JP', baseHolding:   1_350, cadenceDays:  6, minBuy:   30, maxBuy:  250 },
  { ticker: 'CLSK',  name: 'CleanSpark',        listLocation: 'US', baseHolding:   8_900, cadenceDays: 11, minBuy:  100, maxBuy:  500 },
];

function generateDemoTreasuryHistory(ticker: string, days = 60): BtcPurchaseRow[] {
  const c = DEMO_TREASURY_COMPANIES.find((co) => co.ticker.toUpperCase() === ticker.toUpperCase());
  if (!c) return [];
  const seed = hashSeed(`tr-${ticker}-${new Date().toISOString().slice(0, 10)}`);
  const rng = mulberry32(seed);
  const out: BtcPurchaseRow[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let holding = c.baseHolding;
  for (let i = 0; i < days; i++) {
    if (i % c.cadenceDays !== 0) continue;
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const acq = c.minBuy + Math.floor(rng() * (c.maxBuy - c.minBuy));
    const avgCost = 60_000 + rng() * 30_000;
    out.push({
      date: d.toISOString().slice(0, 10),
      ticker: c.ticker,
      btcHolding: holding,
      btcAcq: acq,
      acqCost: acq * avgCost,
      avgBtcCost: avgCost,
    });
    holding -= acq;
  }
  return out;
}

export async function fetchBtcTreasuries(): Promise<BtcTreasuryCompany[]> {
  if (isDemo() || !hasSosoKey()) {
    return DEMO_TREASURY_COMPANIES.map((c) => ({ ticker: c.ticker, name: c.name, listLocation: c.listLocation }));
  }
  try {
    const res = await sosoValueClient.get('/openapi/v1/btc-treasuries') as unknown[] | { data?: unknown };
    const raw = Array.isArray(res) ? res : ((res as { data?: unknown })?.data ?? []);
    const arr = Array.isArray(raw) ? raw : [];
    const mapped = arr.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        ticker: String(o.ticker ?? ''),
        name: String(o.name ?? ''),
        listLocation: String(o.list_location ?? o.listLocation ?? ''),
      };
    }).filter((c) => c.ticker);
    if (mapped.length === 0) {
      return DEMO_TREASURY_COMPANIES.map((c) => ({ ticker: c.ticker, name: c.name, listLocation: c.listLocation }));
    }
    return mapped;
  } catch {
    return DEMO_TREASURY_COMPANIES.map((c) => ({ ticker: c.ticker, name: c.name, listLocation: c.listLocation }));
  }
}

export async function fetchBtcPurchaseHistory(ticker: string, limit = 50): Promise<BtcPurchaseRow[]> {
  if (isDemo() || !hasSosoKey()) {
    return generateDemoTreasuryHistory(ticker, 90).slice(0, limit);
  }
  try {
    const res = await sosoValueClient.get(`/openapi/v1/btc-treasuries/${encodeURIComponent(ticker)}/purchase-history?limit=${limit}`) as unknown[] | { data?: unknown };
    const raw = Array.isArray(res) ? res : ((res as { data?: unknown })?.data ?? []);
    const arr = Array.isArray(raw) ? raw : [];
    const mapped = arr.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        date: String(o.date ?? ''),
        ticker: String(o.ticker ?? ticker),
        btcHolding: Number(o.btc_holding ?? o.btcHolding ?? 0),
        btcAcq:     Number(o.btc_acq     ?? o.btcAcq     ?? 0),
        acqCost:    Number(o.acq_cost    ?? o.acqCost    ?? 0),
        avgBtcCost: Number(o.avg_btc_cost ?? o.avgBtcCost ?? 0),
      };
    });
    return mapped.length > 0 ? mapped : generateDemoTreasuryHistory(ticker, 90).slice(0, limit);
  } catch {
    return generateDemoTreasuryHistory(ticker, 90).slice(0, limit);
  }
}

/**
 * Aggregate net institutional BTC buys across the demo universe over a
 * trailing window. Used both by the BtcTreasuries page summary and by the
 * BtcPredictor as its 9th signal.
 */
export async function aggregateInstitutionalBtcFlow(daysWindow = 30): Promise<{
  totalBtc: number;
  buyerCount: number;
  topBuyer: { ticker: string; btc: number } | null;
  /** -1..+1 — normalised flow signal for the BtcPredictor 9th input. */
  signal: number;
}> {
  const list = await fetchBtcTreasuries();
  const cutoff = Date.now() - daysWindow * 86_400_000;
  let total = 0;
  let buyers = 0;
  const perTicker: Record<string, number> = {};
  // To keep API usage bounded we only sample the top-8 demo names; in live
  // mode the same list is used so worst case = 8 calls per refresh.
  const sample = list.slice(0, 8);
  await Promise.all(
    sample.map(async (co) => {
      try {
        const rows = await fetchBtcPurchaseHistory(co.ticker, 30);
        const recent = rows.filter((r) => new Date(r.date).getTime() >= cutoff);
        const sum = recent.reduce((s, r) => s + r.btcAcq, 0);
        if (sum > 0) {
          total += sum;
          buyers += 1;
          perTicker[co.ticker] = sum;
        }
      } catch {
        // skip
      }
    }),
  );
  let topBuyer: { ticker: string; btc: number } | null = null;
  for (const [t, b] of Object.entries(perTicker)) {
    if (!topBuyer || b > topBuyer.btc) topBuyer = { ticker: t, btc: b };
  }
  // Normalise: 5,000 BTC over 30 days ≈ saturated bullish.
  const signal = Math.max(-1, Math.min(1, total / 5_000));
  return { totalBtc: total, buyerCount: buyers, topBuyer, signal };
}

// ─── Fundraising ──────────────────────────────────────────────────────────

export interface FundraisingProject {
  projectId: string;
  projectName: string;
  /** Synthetic in demo mode; absent on live API list endpoint. */
  sector?: string;
  amountUsd?: number;
  round?: string;
  date?: number;
  leadInvestor?: string;
}

type DemoFundraisingSector =
  | 'DeFi' | 'AI' | 'Layer 2' | 'Gaming' | 'Infrastructure'
  | 'Stablecoins' | 'NFT' | 'Privacy' | 'RWA' | 'SocialFi';
const DEMO_FUNDRAISING_PROJECTS: { name: string; sector: DemoFundraisingSector; }[] = [
  { name: 'Monad Labs',          sector: 'Layer 2' },
  { name: 'Berachain',           sector: 'Layer 2' },
  { name: 'EigenLayer',          sector: 'Infrastructure' },
  { name: 'Babylon Chain',       sector: 'Infrastructure' },
  { name: 'Ondo Finance',        sector: 'RWA' },
  { name: 'Ethena Labs',         sector: 'Stablecoins' },
  { name: 'Hyperliquid',         sector: 'DeFi' },
  { name: 'Aevo',                sector: 'DeFi' },
  { name: 'Fluent Finance',      sector: 'DeFi' },
  { name: 'Phala Network',       sector: 'AI' },
  { name: 'Bittensor TaoStats',  sector: 'AI' },
  { name: 'PIN AI',              sector: 'AI' },
  { name: 'Pixels',              sector: 'Gaming' },
  { name: 'Off The Grid',        sector: 'Gaming' },
  { name: 'Aleo',                sector: 'Privacy' },
  { name: 'Aztec Network',       sector: 'Privacy' },
  { name: 'Friend.tech v2',      sector: 'SocialFi' },
  { name: 'Lens Protocol',       sector: 'SocialFi' },
  { name: 'Story Protocol',      sector: 'NFT' },
  { name: 'Sound.xyz',           sector: 'NFT' },
];

const DEMO_INVESTORS = [
  'Paradigm', 'a16z crypto', 'Multicoin Capital', 'Pantera Capital',
  'Polychain Capital', 'Dragonfly', 'Variant', 'Framework Ventures',
  'Coinbase Ventures', 'Binance Labs', 'Galaxy Ventures', 'Hashed',
];

const DEMO_ROUNDS = ['Seed', 'Series A', 'Series B', 'Strategic', 'Pre-Seed'];

function generateDemoFundraising(): FundraisingProject[] {
  const seed = hashSeed(`fund-${new Date().toISOString().slice(0, 10)}`);
  const rng = mulberry32(seed);
  const now = Date.now();
  return DEMO_FUNDRAISING_PROJECTS.map((p, i) => {
    const daysAgo = Math.floor(rng() * 21); // last 3 weeks
    const amount = Math.round((5 + rng() * 95) * 1_000_000);
    const round = DEMO_ROUNDS[Math.floor(rng() * DEMO_ROUNDS.length)];
    const lead = DEMO_INVESTORS[Math.floor(rng() * DEMO_INVESTORS.length)];
    return {
      projectId: `demo-fund-${i}`,
      projectName: p.name,
      sector: p.sector,
      amountUsd: amount,
      round,
      date: now - daysAgo * 86_400_000,
      leadInvestor: lead,
    };
  }).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

export async function fetchFundraisingProjects(): Promise<FundraisingProject[]> {
  if (isDemo() || !hasSosoKey()) {
    return generateDemoFundraising();
  }
  try {
    const res = await sosoValueClient.get('/openapi/v1/fundraising/projects') as unknown[] | { data?: unknown };
    const raw = Array.isArray(res) ? res : ((res as { data?: unknown })?.data ?? []);
    const arr = Array.isArray(raw) ? raw : [];
    const mapped = arr.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        projectId: String(o.project_id ?? o.projectId ?? ''),
        projectName: String(o.project_name ?? o.projectName ?? ''),
      } satisfies FundraisingProject;
    }).filter((p) => p.projectId);
    if (mapped.length === 0) return generateDemoFundraising();
    // The list endpoint does not include round / amount / sector — only
    // surface the demo enriched view when keys aren't present, otherwise
    // hand back the bare list (callers can hit /projects/{id} for detail).
    return mapped;
  } catch {
    return generateDemoFundraising();
  }
}

/** Group the (possibly demo) project list by sector and return totals + top item. */
export function aggregateFundraisingBySector(rows: FundraisingProject[]): {
  sector: string;
  totalUsd: number;
  count: number;
  topProject: FundraisingProject | null;
}[] {
  const buckets = new Map<string, { totalUsd: number; count: number; top: FundraisingProject | null }>();
  for (const r of rows) {
    const key = r.sector ?? 'Other';
    const existing = buckets.get(key) ?? { totalUsd: 0, count: 0, top: null };
    existing.totalUsd += r.amountUsd ?? 0;
    existing.count += 1;
    if (!existing.top || (r.amountUsd ?? 0) > (existing.top.amountUsd ?? 0)) {
      existing.top = r;
    }
    buckets.set(key, existing);
  }
  return Array.from(buckets.entries())
    .map(([sector, v]) => ({ sector, totalUsd: v.totalUsd, count: v.count, topProject: v.top }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

// ─── Sector Spotlight ─────────────────────────────────────────────────────

export interface SectorRow {
  name: string;
  change24hPct: number;       // already in % (e.g. -1.2 = -1.2%)
  marketcapDom: number;       // 0..1
}

export interface SpotlightRow {
  name: string;
  change24hPct: number;
}

export interface SectorSpotlightSnapshot {
  sectors: SectorRow[];
  spotlight: SpotlightRow[];
}

const DEMO_SECTORS = ['btc', 'eth', 'stablecoin', 'layer1', 'layer2', 'defi', 'meme', 'ai', 'gaming', 'rwa', 'socialfi', 'depin'];
const DEMO_SPOTLIGHT = ['perpdex', 'restaking', 'btcfi', 'modular', 'parallel-evm', 'intents', 'agents'];

function generateDemoSectorSpotlight(): SectorSpotlightSnapshot {
  const seed = hashSeed(`sector-${new Date().toISOString().slice(0, 10)}`);
  const rng = mulberry32(seed);
  // Make sure dominance sums roughly to 1 across the basket.
  const rawDoms = DEMO_SECTORS.map((s, i) => {
    if (s === 'btc') return 0.55;
    if (s === 'eth') return 0.18;
    if (s === 'stablecoin') return 0.08;
    return 0.005 + rng() * 0.025 + (i < 6 ? 0.01 : 0);
  });
  const total = rawDoms.reduce((a, b) => a + b, 0);
  const sectors: SectorRow[] = DEMO_SECTORS.map((name, i) => ({
    name,
    change24hPct: (rng() - 0.45) * 8, // ±4% range, slight bullish bias
    marketcapDom: rawDoms[i] / total,
  }));
  const spotlight: SpotlightRow[] = DEMO_SPOTLIGHT.map((name) => ({
    name,
    change24hPct: (rng() - 0.45) * 12,
  }));
  return { sectors, spotlight };
}

export async function fetchSectorSpotlight(): Promise<SectorSpotlightSnapshot> {
  if (isDemo() || !hasSosoKey()) {
    return generateDemoSectorSpotlight();
  }
  try {
    const res = await sosoValueClient.get('/openapi/v1/currencies/sector-spotlight') as { data?: unknown } | unknown;
    const raw = ((res as { data?: unknown })?.data ?? res) as Record<string, unknown>;
    const sectorsRaw = Array.isArray(raw?.sector) ? raw.sector as Record<string, unknown>[] : [];
    const spotlightRaw = Array.isArray(raw?.spotlight) ? raw.spotlight as Record<string, unknown>[] : [];
    const sectors = sectorsRaw.map((r) => ({
      name: String(r.name ?? ''),
      change24hPct: Number(r['24h_change_pct'] ?? r.change24hPct ?? 0) * 100,
      marketcapDom: Number(r.marketcap_dom ?? r.marketcapDom ?? 0),
    })).filter((s) => s.name);
    const spotlight = spotlightRaw.map((r) => ({
      name: String(r.name ?? ''),
      change24hPct: Number(r['24h_change_pct'] ?? r.change24hPct ?? 0) * 100,
    })).filter((s) => s.name);
    if (sectors.length === 0) return generateDemoSectorSpotlight();
    return { sectors, spotlight };
  } catch {
    return generateDemoSectorSpotlight();
  }
}

// ─── Crypto Stocks ────────────────────────────────────────────────────────

export interface CryptoStockListItem {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  website?: string;
  twitter?: string;
}

export interface CryptoStockSnapshot {
  ticker: string;
  marketPrice: number;
  marketStatus: string;
  volume: number;
  turnover: number;
  circulatingMarketCap: number;
  totalMarketCap: number;
  totalShares: number;
  circulatingShares: number;
  peTtm: number | null;
  pb: number | null;
  /** Synthesized 24h % change (not on the API, computed from prior demo close or omitted live). */
  change24hPct?: number;
}

const DEMO_CRYPTO_STOCKS: { ticker: string; name: string; exchange: string; sector: string; basePrice: number; sharesM: number }[] = [
  { ticker: 'MSTR', name: 'MicroStrategy',     exchange: 'NASDAQ', sector: 'BTC Treasury',  basePrice: 1675, sharesM: 19   },
  { ticker: 'COIN', name: 'Coinbase Global',   exchange: 'NASDAQ', sector: 'Exchange',      basePrice:  287, sharesM: 252  },
  { ticker: 'MARA', name: 'Marathon Digital',  exchange: 'NASDAQ', sector: 'Mining',        basePrice:   24, sharesM: 320  },
  { ticker: 'RIOT', name: 'Riot Platforms',    exchange: 'NASDAQ', sector: 'Mining',        basePrice:   13, sharesM: 290  },
  { ticker: 'CLSK', name: 'CleanSpark',        exchange: 'NASDAQ', sector: 'Mining',        basePrice:   12, sharesM: 285  },
  { ticker: 'HUT',  name: 'Hut 8',             exchange: 'NASDAQ', sector: 'Mining',        basePrice:   18, sharesM:  90  },
  { ticker: 'HOOD', name: 'Robinhood Markets', exchange: 'NASDAQ', sector: 'Brokerage',     basePrice:   45, sharesM: 880  },
  { ticker: 'SQ',   name: 'Block, Inc.',       exchange: 'NYSE',   sector: 'Payments',      basePrice:   88, sharesM: 615  },
  { ticker: 'TSLA', name: 'Tesla',             exchange: 'NASDAQ', sector: 'BTC Treasury',  basePrice:  248, sharesM: 3175 },
  { ticker: '3350', name: 'Metaplanet',        exchange: 'TSE',    sector: 'BTC Treasury',  basePrice:    9, sharesM:  90  },
];

function generateDemoStockSnapshot(ticker: string): CryptoStockSnapshot | null {
  const c = DEMO_CRYPTO_STOCKS.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
  if (!c) return null;
  const seed = hashSeed(`stock-${c.ticker}-${new Date().toISOString().slice(0, 10)}`);
  const rng = mulberry32(seed);
  const change = (rng() - 0.45) * 5; // ±2.5%
  const price = +(c.basePrice * (1 + change / 100)).toFixed(2);
  const shares = c.sharesM * 1e6;
  return {
    ticker: c.ticker,
    marketPrice: price,
    marketStatus: 'open',
    volume: Math.round(rng() * 8_000_000 + 500_000),
    turnover: Math.round(rng() * 8_000_000 * price),
    circulatingMarketCap: price * shares * 0.95,
    totalMarketCap: price * shares,
    totalShares: shares,
    circulatingShares: shares * 0.95,
    peTtm: rng() > 0.3 ? +(15 + rng() * 80).toFixed(1) : null,
    pb: rng() > 0.3 ? +(1 + rng() * 9).toFixed(2) : null,
    change24hPct: +change.toFixed(3),
  };
}

export async function fetchCryptoStocks(): Promise<CryptoStockListItem[]> {
  if (isDemo() || !hasSosoKey()) {
    return DEMO_CRYPTO_STOCKS.map((s) => ({
      ticker: s.ticker, name: s.name, exchange: s.exchange, sector: s.sector,
    }));
  }
  try {
    const res = await sosoValueClient.get('/openapi/v1/crypto-stocks') as unknown[] | { data?: unknown };
    const raw = Array.isArray(res) ? res : ((res as { data?: unknown })?.data ?? []);
    const arr = Array.isArray(raw) ? raw : [];
    const mapped = arr.map((r) => {
      const o = r as Record<string, unknown>;
      const sm = (o.social_media ?? o.socialMedia) as Record<string, unknown> | undefined;
      return {
        ticker: String(o.ticker ?? ''),
        name: String(o.name ?? ''),
        exchange: String(o.exchange ?? ''),
        sector: String(o.sector ?? ''),
        website: sm?.website ? String(sm.website) : undefined,
        twitter: sm?.twitter ? String(sm.twitter) : undefined,
      };
    }).filter((s) => s.ticker);
    return mapped.length > 0 ? mapped : DEMO_CRYPTO_STOCKS.map((s) => ({
      ticker: s.ticker, name: s.name, exchange: s.exchange, sector: s.sector,
    }));
  } catch {
    return DEMO_CRYPTO_STOCKS.map((s) => ({
      ticker: s.ticker, name: s.name, exchange: s.exchange, sector: s.sector,
    }));
  }
}

export async function fetchCryptoStockSnapshot(ticker: string): Promise<CryptoStockSnapshot | null> {
  if (isDemo() || !hasSosoKey()) {
    return generateDemoStockSnapshot(ticker);
  }
  try {
    const res = await sosoValueClient.get(`/openapi/v1/crypto-stocks/${encodeURIComponent(ticker)}/market-snapshot`) as { data?: unknown } | unknown;
    const r = ((res as { data?: unknown })?.data ?? res) as Record<string, unknown>;
    if (!r) return generateDemoStockSnapshot(ticker);
    return {
      ticker: String(r.ticker ?? ticker),
      marketPrice:           Number(r.mkt_price ?? r.marketPrice ?? 0),
      marketStatus:          String(r.mkt_status ?? r.marketStatus ?? 'unknown'),
      volume:                Number(r.volume ?? 0),
      turnover:              Number(r.turnover ?? 0),
      circulatingMarketCap:  Number(r.circulating_marketcap ?? r.circulatingMarketCap ?? 0),
      totalMarketCap:        Number(r.total_marketcap ?? r.totalMarketCap ?? 0),
      totalShares:           Number(r.total_shares ?? r.totalShares ?? 0),
      circulatingShares:     Number(r.circulating_shares ?? r.circulatingShares ?? 0),
      peTtm:                 r.pe_ttm != null ? Number(r.pe_ttm) : (r.peTtm != null ? Number(r.peTtm) : null),
      pb:                    r.pb != null ? Number(r.pb) : null,
    };
  } catch {
    return generateDemoStockSnapshot(ticker);
  }
}

// ─── Demo-mode sentiment helper (no Gemini key required) ──────────────────

export type DemoSentimentResult = {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  /** 0..100, deterministic per headline so the UI is stable across renders. */
  confidence: number;
};

/**
 * Deterministic synthetic sentiment for a headline.
 *  - Strong keywords ("approved", "ETF", "hack", "ban") tilt the verdict
 *    so the demo feels intelligent rather than random.
 *  - Confidence is constrained to 60–80% (per request) to mimic a real
 *    AI's typical post-softmax certainty band.
 */
export function fakeSentimentForHeadline(title: string): DemoSentimentResult {
  if (!title) return { sentiment: 'NEUTRAL', confidence: 60 };
  const seed = hashSeed(title);
  const rng = mulberry32(seed);

  const lower = title.toLowerCase();
  let bias = 0;
  // Strong bullish cues
  if (/(approved|approval|partnership|surge|rally|all[- ]?time high|ath|breakout|halving|inflow|adopt|integrat|launch|listing|upgrade)/.test(lower)) bias += 1;
  if (/(institutional|treasury|reserve|bullish|breakout)/.test(lower)) bias += 0.5;
  // Strong bearish cues
  if (/(hack|exploit|rug|ban|reject|delist|crash|liquidat|lawsuit|sec sues|charges|outflow|bearish|plunge|drop|halt)/.test(lower)) bias -= 1;
  if (/(warning|risk|investigat)/.test(lower)) bias -= 0.5;

  const bucket = bias + (rng() - 0.5) * 0.8;
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  if (bucket > 0.30) sentiment = 'BULLISH';
  else if (bucket < -0.30) sentiment = 'BEARISH';
  else sentiment = 'NEUTRAL';

  // Confidence band 60-80 with slight increase when bias is strong.
  const base = 60 + Math.round(rng() * 20);          // 60–80
  const boost = Math.min(8, Math.round(Math.abs(bias) * 6));
  const confidence = Math.min(80, base + (sentiment === 'NEUTRAL' ? 0 : boost));

  return { sentiment, confidence };
}
