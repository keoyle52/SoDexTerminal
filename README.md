# 🚀 Sodex PowerOps: AI-Driven Agentic Trading Terminal

[![SoSoValue Buildathon](https://img.shields.io/badge/SoSoValue-Buildathon_Wave_3-blueviolet?style=for-the-badge)](https://sosovalue.com/)
[![SoDEX Protocol](https://img.shields.io/badge/SoDEX-Protocol_ValueChain-emerald?style=for-the-badge)](https://sodex.com/)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini_2.0_Flash-orange?style=for-the-badge)](https://deepmind.google/technologies/gemini/)
[![Live Demo](https://img.shields.io/badge/🔴_LIVE-DEMO-red?style=for-the-badge)](https://sodexterminal.vercel.app)

> **The ultimate "One-Person On-Chain Hedge Fund" terminal.** Sodex PowerOps leverages high-frequency SoSoValue data, institutional flows, macroeconomic indicators, and Google Gemini AI to orchestrate and execute autonomous trading agents on the SoDEX ValueChain.

---

## 🌟 Overview

Sodex PowerOps is an **Agentic Finance Ecosystem** developed for the **SoSoValue x Akindo Buildathon (Wave 3, July 2026)**. By bridging the gap between raw research data and real-time execution, it allows retail traders to run automated, hedge-fund-level quantitative strategies on-chain. 

For Wave 3, we have completely overhauled the platform's security, restructured the UI/UX for ultra-low latency, and developed a fully functional autonomous trading engine. By removing previous constraints and adding robust safety guardrails, Sodex PowerOps stands as a production-ready Web3 algorithmic suite.

---

## 🛠 Core Features & Architecture

### 1. 🛡️ 100% Non-Custodial Web3 Security & Session Key Delegation
Addressing critical feedback from the Wave 2 jury regarding client-side private key storage:
*   **Non-Custodial Connection:** Users connect their EVM wallets via MetaMask or WalletConnect. All manual trading orders are signed using standard browser-level `eth_signTypedData_v4` typed data signature relays. Raw private keys are never stored in the browser.
*   **Session Key Delegation:** For 24/7 background automation, users authorize a restricted **Session Key** on SoDEX with a user-specified expiry duration. The bots execute signed orders using this delegated session key, which is locked to trading functions only, ensuring the user's primary wallet remains completely secure.

### 2. 🤖 Wave 3 Autonomous Agent Mode (`wave3Engine.ts`)
A fully autonomous (self-operating) background quant daemon that continuously monitors the markets without requiring any user interaction:
*   **Regime Classification:** Fuses RSI, EMA crossovers, MACD momentum, Bollinger Bands, and volatility spreads to identify market conditions in real-time.
*   **Automatic Bot Rotation:** Automatically rotates trading bots based on the detected regime:
    *   **Grid Bot** is deployed during **High Volatility** regimes.
    *   **DCA Bot** is deployed to accumulate spot assets in **Trending Up** conditions.
    *   **Signal Bot** is deployed for leveraged shorting in **Trending Down** markets.
    *   **Preserve Mode** halts orders and holds capital safely in stable assets during **Consolidation** to protect capital.
*   **Centralized Risk Shield (Flash Crash Protection):** If the engine detects a sudden price crash exceeding 3% in a 10s window, it automatically closes all active positions, cancels outstanding orders, elevates the risk level to `CRITICAL`, and halts operations. It restarts only when price movements stabilize.

### 3. 🧠 Rebuilt Gemini Signal Studio & Multi-Signal Bot (`SignalBot.tsx`)
The Signal Bot has been completely refactored from scratch into a full-screen **Visual Quant Studio**, introducing highly detailed technical, macro, and sentiment parameters:
*   **Multi-Signal Evaluation Engine:** Fuses 9+ built-in indicators across distinct categories:
    *   *Technical Oscillators:* RSI, MACD, Stochastic RSI, Bollinger Bands, EMA Crossover, and Volume Spike.
    *   *SoSoValue AI Sentiment:* Evaluates live news sentiment scores fetched dynamically from SoSoValue hot news feeds.
    *   *ETF Net Flows:* Triggers signals based on daily net inflows/outflows of Spot Bitcoin and Ethereum ETFs.
    *   *Macro Correlation:* Monotors DXY (U.S. Dollar Index) movements to predict macro capital shifts.
*   **Custom Code Expression Engine:** Quant developers can write custom JavaScript expressions (using variables like `rsi(14)`, `ema(9)`, `close`, `volume`) to define their own math-based execution criteria.
*   **Interactive Validation Sandbox:** Allows users to run real-time sanity tests on their combined indicators against live chart markers before deploying live capital.
*   **Conflict Resolution Policies:** Enforces strict risk management when signals conflict, offering policies like `IGNORE`, `CLOSE_ONLY` (closes opposing trades), or `CLOSE_AND_REVERSE`.

### 4. 🧠 Local AI Engine & Fallback Architecture (`localAiEngine.ts`)
We eliminated single points of failure related to API limits or key issues:
*   **Local AI Fallback:** If the external Gemini API Key is missing or rate-limited, our custom deterministic quantitative engine automatically takes over.
*   **Seamless Diagnostics:** It runs regime classification, calculates optimal bot configuration parameters, and performs wallet diagnostics locally without any downtime.

### 5. 👯 Mirror: AI-Powered Copy-Trading Suite (`MirrorTool.tsx`)
A completely new feature allowing users to mirror the trades of top-performing wallets on SoDEX:
*   **Neural Wallet Diagnostics:** Inputting any EVM address triggers an AI-driven behavioral audit. It analyzes historical fills to measure win-rates, average hold times, max leverage, and categorizes their style (Conservative, Moderate, Aggressive).
*   **AI Co-Pilot Auditing:** When the source wallet takes a trade, the backend copilot engine audits the order using Gemini 2.0 Flash against latest SoSoValue hot news sentiment. It can auto-reject or queue trades for manual approval if the risk score exceeds user-set parameters.

### 6. 🚥 Pre-Flight Risk Setup (`BotRiskSetupModal.tsx`)
All automated bots now undergo a compulsory "Pre-Flight Check" prior to deployment:
*   **AI Risk Override Limit:** Pauses bot execution if real-time sentiment risk exceeds a specific score.
*   **Fee Drag Protection:** Automatically restricts orders where estimated transaction fees (SoDEX 0.08% roundtrip) would eat up the projected profit.
*   **Bot Auto-Kill (Max Loss Switch):** Shuts down the bot instantly if losses hit a user-configured limit (in USD or % equity).
*   **Flash-Crash Slippage Limit:** Restricts execution during liquidity dry-ups.

### 7. 📊 Backtest Studio (`BacktestStudio.tsx`)
Simulate quantitative strategies before deploying live capital:
*   **Mainnet Alignment:** Pulls historical klines (real Binance data or volatile simulated klines) to run historical simulations.
*   **Fee Modeling:** Demonstrates the impact of fee friction, proving why short-term high-frequency trades often underperform compared to macro timeframe expectancies.
*   **Performance Metrics:** Computes real-time Sharpe ratio, profit factors, monthly expectancies, and accumulated volume.

### 8. 🎨 Premium UI/UX Overhaul & Bloat Cleanup
*   **Sleek Navigation:** Replaced the heavy sidebar navigation with a unified, professional floating **Header Dock** matching modern trading terminals.
*   **Ticker Tape Marquee:** Shows live asset pricing, SSI sentiment indicators, and portfolio VaR.
*   **Bloat Reduction:** Cleaned up 20,000+ lines of legacy code, unused packages, and inactive features (like Telegram integration and news bot templates) to guarantee sub-second page loads.

---

## 🏗 Tech Stack

*   **Frontend:** React 19, TypeScript, Vite 8, Zustand v5 (Persisted slices).
*   **Styling:** TailwindCSS v4 & Vanilla CSS (Modern dark glassmorphism).
*   **Execution Backend:** Node.js, Express, WebSocket (Proxy client for secure API interactions).
*   **AI Engine:** Google Gemini 2.0 Flash API (Audit copilot) + Local AI Engine.
*   **Data Feeds:** SoSoValue API (News, ETFs, Sector Spotlight, Indices, Treasuries).
*   **Smart Wallet Signing:** Ethers.js v6 + Web3 Browser Provider (`eth_signTypedData_v4`).

---

## 📈 Installation & Running Locally

### Prerequisites
*   Node.js (v18+)
*   npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/keoyle52/SoDexTerminal.git
cd SoDexTerminal/sodexpowerops
```

### 2. Configure Environment Variables
Create a `.env` file in the root of `sodexpowerops` and `sodexpowerops/backend`:
```env
VITE_API_BASE_URL=http://localhost:5000
GEMINI_API_KEY=your_gemini_api_key
SOSOVALUE_API_KEY=your_sosovalue_api_key
```

### 3. Install and run the backend
```bash
cd backend
npm install
npm run dev
```

### 4. Install and run the frontend
```bash
cd ..
npm install
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 🎯 Hackathon Judging Criteria Alignment

*   **User Value (30%):** Validates performance metrics (Sharpe, Drawdown) to protect capital while enabling users to run a "one-person hedge fund."
*   **Functionality (25%):** Fully functional on-chain EIP-712 order execution with comprehensive backtesting and Wallet connection.
*   **Product Design (20%):** Fully responsive modern dark-mode Glassmorphic UI with micro-animations and clean charts.
*   **Data/API Integration (15%):** Ingests news, ETF, macro, fundraising, SSI index, and treasury data from SoSoValue alongside Gemini AI reasoning.
*   **UX & Clarity (10%):** Clear consensus visual flows and explanatory cards on quantitative trading mechanics (e.g., fee friction).

---

## 🛡 Disclaimer
*This software is developed for educational and hackathon purposes. Trading cryptocurrencies involves significant financial risk. The authors are not responsible for any financial losses.*
