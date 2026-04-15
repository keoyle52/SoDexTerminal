# SoDEX Terminal

A professional-grade, web-based trading toolset for the [SoDEX](https://sodex.dev) decentralized exchange. Built for the SoDEX Buildathon.

![Dashboard](https://img.shields.io/badge/status-live-brightgreen) ![Build](https://img.shields.io/badge/build-passing-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue) ![React](https://img.shields.io/badge/React-19-61dafb)

---

## Features

| Page | Description |
|---|---|
| **Dashboard** | Live market overview — candlestick chart (BTC-USD), real-time ticker table, portfolio stats |
| **Grid Bot** | Automated grid trading — place buy/sell limit orders across a price range |
| **TWAP Bot** | Time-Weighted Average Price execution — split large orders into scheduled slices |
| **DCA Bot** | Dollar-Cost Averaging — recurring buy/sell at a fixed interval |
| **Copy Trader** | Mirror another wallet's trades in real time using on-chain order monitoring |
| **Positions** | View and close open perps positions with live PnL and margin tracking |
| **Funding Tracker** | Real-time funding rates, APR rankings, and personal funding estimates |
| **Dead Man's Switch** | Scheduled order cancellation safety switch — auto-cancel all orders on timeout |
| **Alerts** | Browser-based price alerts with desktop notifications |
| **Backtesting** | Backtest SMA Crossover, RSI, and Breakout strategies on historical kline data |
| **Settings** | Configure API key, private key (EIP-712 signing), network (mainnet/testnet) |

---

## Tech Stack

- **React 19** + **TypeScript** — component framework
- **Vite** — build tool with code splitting (every page is a lazy-loaded chunk)
- **TailwindCSS v4** — design system
- **Zustand** — state management
- **ethers.js v6** — EIP-712 signing for authenticated API calls
- **lightweight-charts v5** — TradingView-compatible candlestick charts
- **React Router v7** — client-side routing

---

## Quick Start

```bash
git clone https://github.com/keoyle52/testingsomething
cd testingsomething
npm install
npm run dev        # dev server → http://localhost:5173
npm run build      # production build (zero TS errors)
npm run lint       # ESLint check
```

---

## Configuration

1. Open the app and go to **Settings → API Connection**.
2. Enter your **API Key Name** (from your SoDEX account dashboard).
3. Enter your **Private Key** — used locally for EIP-712 request signing. Never sent to any server; stored only in `localStorage`.
4. Select **Testnet** or **Mainnet**.
5. Click **Test Connection** to verify.

| Field | Description |
|---|---|
| API Key Name | Key name registered in your SoDEX account |
| Private Key | EVM private key for signing (stays in browser) |
| Default Symbol | Default trading pair shown on dashboard (e.g. `BTC-USD`) |
| Testnet | Switches all endpoints between mainnet and testnet |

---

## API & Signing

All authenticated requests use **EIP-712** signatures:

1. **Nonce** — monotonically increasing counter (never repeats within the same millisecond).
2. **Payload hash** — `keccak256(stableStringify(payload))` where keys are sorted alphabetically for deterministic output.
3. **Signature** — `ExchangeAction { payloadHash, nonce }` prefixed with `0x01`.

### Symbol format

| Market | Format | Example |
|---|---|---|
| Perps | `BASE-USD` hyphen-separated | `BTC-USD` |
| Spot | `BASE_USDC` underscore-separated | `BTC_USDC` |

The `normalizeSymbol()` helper in `services.ts` converts between formats automatically.

### Order placement (perps)

```
fetchPerpsAccountState()  →  accountID
fetchSymbolEntry()        →  symbolID
placePerpsOrder()         →  POST /trade/orders
  payload: { accountID, symbolID, orders: [{ clOrdID, modifier, side, type, timeInForce, price?, quantity, reduceOnly, positionSide }] }
```

Body-level errors (`code !== 0`) are thrown as `Error` even when HTTP status is 200.

---

## Project Structure

```
src/
├── api/
│   ├── perpsClient.ts     – Axios instance for perps endpoint (signs every request)
│   ├── spotClient.ts      – Axios instance for spot endpoint
│   ├── services.ts        – High-level API helpers (placeOrder, fetchKlines, normalizeSymbol, …)
│   ├── signer.ts          – EIP-712 signing + monotonic nonce + stableStringify
│   └── websocket.ts       – WebSocket helper for live order/price updates
├── components/
│   ├── TradingChart.tsx   – lightweight-charts v5 candlestick chart
│   ├── Sidebar.tsx        – Navigation sidebar
│   ├── Topbar.tsx         – Top bar with wallet/network status
│   └── common/            – Reusable UI components (Button, Input, Card, Modal, …)
├── pages/
│   ├── Dashboard.tsx
│   ├── GridBot.tsx
│   ├── TwapBot.tsx
│   ├── DcaBot.tsx
│   ├── CopyTrader.tsx
│   ├── Positions.tsx
│   ├── FundingTracker.tsx
│   ├── ScheduleCancel.tsx
│   ├── Alerts.tsx
│   ├── Backtesting.tsx
│   └── Settings.tsx
└── store/
    ├── settingsStore.ts   – API keys, network, default symbol
    └── botStore.ts        – Per-bot state (GridBot, etc.)
```

---

## Known Limitations

- **Copy Trader** requires a public on-chain event feed or WebSocket from SoDEX; currently polls the REST API.
- **Backtesting** runs entirely in-browser on up to 500 candles — not suitable for large datasets.
- **Price Alerts** stop firing when the browser tab is closed.

---

## License

MIT
