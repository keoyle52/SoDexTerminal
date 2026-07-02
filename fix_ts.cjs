const fs = require('fs');
const path = require('path');

// 1. App.tsx
const appPath = path.join(__dirname, 'src', 'App.tsx');
let appContent = fs.readFileSync(appPath, 'utf8');
if (!appContent.includes('startWave3Engine')) {
  appContent = appContent.replace(
    /import \{ startDemoEngine, stopDemoEngine \} from '\.\/api\/demoEngine';/,
    "import { startDemoEngine, stopDemoEngine } from './api/demoEngine';\nimport { startWave3Engine } from './api/wave3Engine';"
  );
  appContent = appContent.replace(
    /useEffect\(\(\) => \{\n\s*preloadCommonPages\(\);\n\s*\}, \[\]\);/,
    "useEffect(() => {\n    preloadCommonPages();\n    startWave3Engine();\n  }, []);"
  );
  fs.writeFileSync(appPath, appContent);
}

// 2. BtcPredictor.tsx
const btcPath = path.join(__dirname, 'src', 'pages', 'BtcPredictor.tsx');
let btcContent = fs.readFileSync(btcPath, 'utf8');
btcContent = btcContent.replace(/symState\.aiVerdict\.verdict/g, "symState.aiVerdict.decision");
btcContent = btcContent.replace(/symState\.aiVerdict\.reasoning/g, "symState.aiVerdict.rationale");
btcContent = btcContent.replace(/symState\.openPosition\.direction/g, "symState.openPosition.side");
fs.writeFileSync(btcPath, btcContent);

// 3. TradingBots.tsx
const tbPath = path.join(__dirname, 'src', 'pages', 'TradingBots.tsx');
let tbContent = fs.readFileSync(tbPath, 'utf8');
tbContent = tbContent.replace(/import \{ \n  Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle, \n  ShieldAlert, ShieldCheck, Cpu, Brain, Zap, CheckCircle2, TrendingUp, Settings, FileText, AlertTriangle \n\} from 'lucide-react';/,
"import {\n  Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle,\n  ShieldAlert, ShieldCheck, Cpu, Brain, Zap, TrendingUp, FileText, AlertTriangle\n} from 'lucide-react';");
tbContent = tbContent.replace(/colorize/g, ""); // remove colorize from NumberDisplay
fs.writeFileSync(tbPath, tbContent);

console.log("Patched all TS errors");
