# 🚀 Sodex PowerOps: AI-Driven Agentic Trading Terminal

[![SoSoValue Buildathon](https://img.shields.io/badge/SoSoValue-Buildathon_Wave_2-blueviolet?style=for-the-badge)](https://sosovalue.com/)
[![SoDEX Protocol](https://img.shields.io/badge/SoDEX-Protocol_ValueChain-emerald?style=for-the-badge)](https://sodex.com/)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini_3.5_Flash-orange?style=for-the-badge)](https://deepmind.google/technologies/gemini/)
[![Live Demo](https://img.shields.io/badge/🔴_LIVE-DEMO-red?style=for-the-badge)](https://sodexterminal.vercel.app)

> **The ultimate "One-Person On-Chain Hedge Fund" terminal.** Sodex PowerOps leverages high-frequency SoSoValue data, institutional flows, macroeconomic indicators, and Google Gemini AI to orchestrate and execute autonomous trading agents on the SoDEX ValueChain.

---

## 🌟 Overview

Sodex PowerOps is an **Agentic Finance Ecosystem** developed for the **SoSoValue x Akindo Buildathon (Wave 2, May 2026)**. It addresses the information overload and execution friction faced by retail traders. By using AI Orchestrators to classify market regimes, it deploys specialized, autonomous algorithmic trading bots executing signed transactions directly on-chain.

### 🧠 The Core Philosophy: "Insight to Action"
Traditional terminals stop at showing data. Sodex PowerOps completes the loop:
1. **Ingest:** Multi-source data ingestion from SoSoValue (News, Spot ETF Flows, Institutional Treasuries, SSI Indices, Sectors, Fundraising) and public Fear & Greed API.
2. **Analyze:** Market regime classification, sentiment extraction, and technical indicators consensus via Google Gemini AI and the local rule engine.
3. **Execute:** Programmatic order execution on SoDEX Perps and Spot markets with sub-second latency using secure local EIP-712 signature keys.

---

## 🛠 Features

### 1. 🔮 BTC Predictor (Headline Ensemble Intelligence)
Our flagship forecasting engine that fuses **13 distinct signals** into a weighted consensus model to execute leveraged perp trades on SoDEX:
- **Technical Indicators:** RSI(14), EMA Cross (9/21), MACD Histogram, VWAP Deviation, Rate of Change (RoC), and Wilder's Average True Range (ATR).
- **On-Chain Microstructure:** Order Book Imbalance Z-Score, Funding Rate Momentum, and Tick Volume Spikes.
- **SoSoValue Fundamentals:** News Sentiment, Spot BTC ETF Net Inflows, and Corporate Treasury Accumulation (e.g., MSTR, Tesla, MARA).
- **External Sentiment:** Crypto Fear & Greed Index contrarian scoring.
- **Gemini AI Overlay:** Gemini 3.5 Flash evaluates the confluence vectors to perform final strategy validation, dynamically adjusting position sizes or aborting execution when sentiment conflicts with technical signals.

### 2. 🤖 AI Strategy Orchestrator & Multi-Bot Suite
The terminal analyzes volatility (ATR) and trend strength to dynamically recommend or rotate specialized bots:
- **Grid Bot:** Geometric/Arithmetic market-making for range-bound low-volatility regimes.
- **TWAP Bot:** Volatility-guarded large order execution slicing to minimize slippage.
- **DCA Bot:** Automated Dollar-Cost Averaging for long-term spot accumulation.
- **Signal Bot:** Custom technical setups with strict ATR-based stop-loss/take-profit guards.
- **AI News Bot:** Scalps market headlines in real-time, extracting ticker sentiment via Gemini and opening corresponding leveraged positions.

### 3. 📈 Validation & Historical Backtesting Engine
Addressing critical feedback from the Wave 1 jury, we implemented a robust validation layer:
- **Performance Dashboard:** Computes real-time Sharpe Ratio, Max Drawdown, Expectancy, Win Rate, Profit Factor, and Monthly Returns.
- **Historical Data-Aligned Backtest:** Replays the exact 13-signal ensemble logic over historical periods, aligning timestamps with actual historical SoSoValue news sentiment, ETF flows, corporate buy histories, and Fear & Greed index values.
- **Timeframe Edge vs. Fee Friction:** Supports backtesting across 1m, 3m, 5m, 15m, and 60m timeframes, visually demonstrating the math of fee friction (unprofitable low timeframes due to Sodex's 0.08% round-trip fee) versus the positive expectancy of macro timeframes.
- **Strategy Report Card:** Side-by-side comparison of bot configurations and correlation analysis with news sentiment.

### 4. 🛡️ Positions & Risk Centre (Capital Preservation)
Addresses jury criticisms regarding failure-case management and safety:
- **Value-at-Risk (VaR):** Computes real-time portfolio margin, leverage, and 95% confidence parametric VaR to warn users of capital exposure.
- **Failure-Case Mitigation Panel:** Outlines automated system defenses (dynamic score filters, stop-loss triggers, and websocket latency guards) against sideways desyncs, flash crashes, and API disconnects.

### 5. 💬 Telegram Bot Integration
Bridges the terminal to the user's mobile device for secure, remote monitoring:
- Link the terminal to a private Telegram chat using simple verification.
- Recieve real-time alerts on AI market regime changes and BTC Predictor signals.
- Streams live bot executions, PnL settlements, and daily performance reports directly to chat.

### 6. 🤝 Strategy Marketplace & Leaderboard
A collaborative hub where users can publish, view, and clone successful bot configurations:
- Creator profiles represented by truncated EVM addresses (linked securely).
- Public leaderboard showing performance metrics.
- One-click copy-trading functionality.

---

## 🏗 Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8 (with Suspense and chunk preloading).
- **Styling:** TailwindCSS v4 & Vanilla CSS (Glassmorphism layout).
- **AI Engine:** Google Gemini 3.5 Flash API.
- **Data Providers:** SoSoValue API (News, ETFs, Treasuries, Sector Spotlight, SSI Indices, Fundraising) & alternative.me.
- **Execution Engine:** SoDEX REST & WebSocket API (Local EIP-712 signature generation using Ethers.js v6).
- **State Management:** Zustand v5 (Persisted slices).
- **Deployment:** Vercel (Continuous integration).

---

## 📈 Roadmap & Milestones

### Wave 1 (Completed)
- [x] Initial EIP-712 Ethers local signature engine.
- [x] Core trading panel for SoDEX Spot and Perps.
- [x] Basic Grid, TWAP, and Signal bots.
- [x] Volatility-based AI Strategy recommender widget.

### Wave 2 (Completed - Current Submission)
- [x] **BTC Predictor Headline Feature:** Unified 13-signal consensus rules + Gemini AI validation.
- [x] **Data-Aligned Backtesting:** Historical backtests incorporating real SoSoValue flow data.
- [x] **Timeframe Optimization:** Timeframe selections (1m - 60m) to analyze profitability vs. fee drag.
- [x] **Positions & Risk Centre:** Real-time 95% VaR calculations and Failure-Case Mitigation Panel.
- [x] **Telegram Bot Integration:** Setup credentials, log streaming, and live alert webhooks.
- [x] **Strategy Marketplace:** Interactive community strategy leaderboard and configuration sharing.
- [x] **UI/UX & Branding Redesign:** Complete dark-mode Glassmorphism layout and custom gradient assets.
- [x] **Mobile Responsiveness:** Redesigned responsive glassmorphic layouts for all viewports.

### Wave 3 (Planned)
- [ ] **Autonomous Agent Mode:** A fully self-operating trading agent that runs 24/7 without human intervention. The AI Orchestrator will continuously monitor market conditions, rotate between bots, dynamically adjust position sizes, and rebalance risk exposure based on live SoSoValue data and Gemini analysis. No clicks required. One deployment. Fully autonomous on-chain execution.

---

## 📊 Judging Criteria Alignment

- **User Value (30%):** Validates performance metrics (Sharpe, Drawdown) to protect capital while enabling users to run a "one-person hedge fund."
- **Functionality (25%):** Fully functional on-chain EIP-712 order execution with comprehensive backtesting and Telegram alerting.
- **Product Design (20%):** Fully responsive modern dark-mode Glassmorphic UI with micro-animations and clean charts.
- **Data/API Integration (15%):** Ingests news, ETF, macro, fundraising, SSI index, and treasury data from SoSoValue alongside Gemini AI reasoning.
- **UX & Clarity (10%):** Clear consensus visual flows and explanatory cards on quantitative trading mechanics (e.g., fee friction).

---

## 🛡 Disclaimer
*This software is developed for educational and hackathon purposes. Trading cryptocurrencies involves significant financial risk. The authors are not responsible for any financial losses.*
