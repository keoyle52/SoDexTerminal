const fs = require('fs');
const path = require('path');

function patchWave3Engine() {
  const file = path.join(__dirname, 'src', 'api', 'wave3Engine.ts');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ useWave3Store, Wave3Regime, Wave3Action \}/, "import { useWave3Store }\nimport type { Wave3Regime, Wave3Action }");
  content = content.replace(/import \{ fetchMarkPriceFor \} from '.\/sosoServices';/, "import { fetchMarkPriceFor } from './btcPredictorEngine';");
  fs.writeFileSync(file, content);
}

function patchWave3Store() {
  const file = path.join(__dirname, 'src', 'store', 'wave3Store.ts');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/export const useWave3Store = create<Wave3Store>\(\(set, get\) => \(\{/, "export const useWave3Store = create<Wave3Store>((set) => ({");
  fs.writeFileSync(file, content);
}

function patchTradingBots() {
  const file = path.join(__dirname, 'src', 'pages', 'TradingBots.tsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import React, \{ useState, useEffect \} from 'react';/, "import React, { useEffect } from 'react';");
  content = content.replace(/import \{ Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle, ShieldAlert, CheckCircle2, AlertTriangle, ShieldCheck, Cpu \} from 'lucide-react';/, "import { Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle, ShieldAlert, ShieldCheck, Cpu, Brain } from 'lucide-react';");
  content = content.replace(/<SymbolSelector selected=\{targetCoin\.replace\('-USD', ''\)\} onChange=\{\(c\) => setTargetCoin\(c \+ '-USD'\)\} \/>/, "<SymbolSelector value={targetCoin.replace('-USD', '')} onChange={(c) => setTargetCoin(c + '-USD')} />");
  content = content.replace(/<NumberDisplay value=\{activePosition\.pnl\} format="currency" className="text-2xl font-black" colorize \/>/, '<NumberDisplay value={activePosition.pnl} prefix="$" decimals={4} trend={activePosition.pnl > 0 ? "up" : activePosition.pnl < 0 ? "down" : "neutral"} />');
  
  // also clean unused riskStore vars inside GenericBotForm if any
  content = content.replace(/const \{ isRiskShieldActive, currentRiskLevel, riskEvents \} = useRiskStore\(\);/, "const { currentRiskLevel } = useRiskStore();");
  
  fs.writeFileSync(file, content);
}

patchWave3Engine();
patchWave3Store();
patchTradingBots();
