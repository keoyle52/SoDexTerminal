# SoDEX PowerOps Terminal

A professional-grade, browser-based trading toolset built on top of the [SoDEX](https://sodex.dev) decentralised perpetuals exchange. Crafted for the **SoDEX Buildathon Wave 1** — every feature runs entirely in the browser with zero backend, using EIP-712 signing and the SoDEX REST + WebSocket APIs directly.

---

## 🎯 Project Overview

**Target User:** Day traders, systematic traders, and crypto natives who need powerful order execution (Grid, TWAP, DCA, Copy Trading) and actionable macro data without installing desktop software or self-hosting bot infrastructure.

**Use Case:** Provides an all-in-one professional workstation extending the native SoDEX UI. It allows users to run complex bots, track crypto ETF institutional flows, and leverage AI to build evidence-based market predictions—all from a single browser tab.

**Data Flow Architecture:**
The app runs **100% in the browser** (no proprietary backend).
- **Authentication:** EIP-712 offline signing using locally persisted keys (`ethers.js`).
- **Market Data:** Live WebSocket feeds direct from Binance/SoDEX infrastructure.
- **Macro Data:** Direct client-to-API requests to SoSoValue for ETF/News data.
- **Execution:** Signed orders are dispatched directly point-to-point to SoDEX REST endpoints.

---

## 🚀 Live Demo & Judging Setup (Demo Mode)

> **Attention Judges:** The application is packed with a fully simulated offline **Demo Engine**. You can evaluate the entire terminal without needing a funded SoDEX mainnet/testnet account or any API keys!

**How to test Demo Mode:**
1. Look for the prominent **"🚀 Try Demo Mode"** button on the Top Navigation Bar.
2. Click it to activate the `demoEngine` — this simulates a live WebSocket feed, order book, mock account balances, and instantly fills orders.
3. Try launching a **Grid Bot**, using the **BTC Predictor**, or viewing the **Positions** page. All features work seamlessly against the synthetic data pipeline.

---

## 🔌 Setup & Local Installation

### Requirements
- Node.js 18+
- npm or yarn

### Installation
```bash
git clone https://github.com/keoyle52/SoDexTerminal
cd SoDexTerminal
npm install
npm run dev        # dev server → http://localhost:5173
npm run build      # production build
```

### API Key Configuration
To trade on live/testnet environments, configure your keys entirely within the browser via the **Settings** page:

1. **SoDEX Credentials:** Supply your EVM Private Key and API Key Name registered on SoDEX. *(Security Note: Keys never leave your browser; they only generate local signatures.)*
2. **SoSoValue API Key:** Required for institutional data tracking and the News Bot.
3. **Gemini API Key:** Required for AI sentiment scoring on crypto news.

---

## 🧩 Deep API Integrations

### SoSoValue Integration
SoSoValue serves as the macro-economic backbone for the terminal's predictive features:
- **News Endpoint (`GET /api/v1/news_feed`)**: Fetches the latest global crypto milestones. We pipeline this directly into a local Gemini AI instance to gauge sentiment impact (Bullish/Bearish).
- **ETF Traffic (`GET /api/v1/etf_metrics`)**: Critical pipeline feeding Bitcoin Spot ETF inflows/outflows directly into the `BTC Price Predictor`. Major retail platforms ignore ETF data locally, but our terminal tracks institutional flows dynamically, combining them with order book data to predict local price movements.

### SoDEX Protocol Depth (Spot & Perps)
We've integrated heavily into the raw SoDEX protocol, migrating capabilities that usually demand a backend node directly into the browser:
- **EIP-712 Typed Signing Layer:** Native implementation to build and send cryptographically signed transaction payloads seamlessly on the user's browser thread.
- **Full Scope Execution:** Complete utilization of Spot and Perps API interfaces, handling Margin adjusting, Order placement/cancellation, exact decimal scaling, and rapid dynamic risk (margin ratio) calculations.
- **Headless Bot Engine:** The Grid and TWAP bots handle their own complex Nonce sequencing and state reconciliation using smart React-level asynchronous polling of the SoDEX endpoints.

---

## 🌟 Core Features

### 📊 Market & Portfolio
| Page | Description |
|---|---|
| **Dashboard** | Live candlestick chart, real-time ticker table, portfolio balance, open position stats, and total unrealised PnL |
| **Positions** | View all open perpetual positions with live mark price, margin ratio, and one-click close |
| **Funding Tracker** | Real-time funding rates, 8-hour APR equivalent, and personal funding P&L estimate |
| **ETF Tracker** | Bitcoin spot ETF flow data from SoSoValue — daily net inflow, cumulative AUM per issuer |

### 🤖 Automated Bots
| Bot | Strategy | Description |
|---|---|---|
| **Grid Bot** | Grid trading | Places a ladder of buy + sell limit orders across a configurable price range. Profits from oscillation |
| **TWAP Bot** | Time-Weighted Avg Price | Splits large orders into equal-size slices executed at a fixed interval to minimise market slippage |
| **DCA Bot** | Dollar-Cost Averaging | Consistently buys/sells a fixed notional amount repeatedly |
| **Copy Trader** | On-chain mirroring | Polls a target wallet's open orders and identically executes them on the user account |

### 🧠 AI Tools (Powered by SoSoValue & Gemini)
| Tool | Description |
|---|---|
| **BTC Price Predictor** | Evidence-based 5-minute BTC direction predictor utilizing 8 signals (ETF, News Sentiment, Order Book Imbalance, Funding Rate, EMA / RSI / MACD). Automatically self-corrects weightings if accuracy drops. |
| **News Bot** | Real-time crypto news populated from SoSoValue with Gemini AI injected sentiment confidence per headline. |

---

## 📸 Submission Materials
- **Live Deployment Link:** *(Provided via the hackathon submission portal)* 
- **Demo Video:** A comprehensive video tutorial highlighting the Dashboard, Bot Execution, and BTC Predictor has been recorded and submitted via the hackathon upload portal.

---

## License
MIT
