const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'BtcPredictor.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Fix symbol declaration order
content = content.replace(/const predictor = usePredictorStore\(\);\s*const symState = predictor\.symbols\[symbol\] \|\| \{[\s\S]*?\} as any;/g, `const predictor = usePredictorStore();`);

content = content.replace(/const symbol = isSoso \? \(isDemoMode \? 'SOSO-USD' : 'WSOSO_vUSDC'\) : \`\$\{selectedAsset\}-USD\`;/, 
`const symbol = isSoso ? (isDemoMode ? 'SOSO-USD' : 'WSOSO_vUSDC') : \`\${selectedAsset}-USD\`;

  const symState = predictor.symbols[symbol] || {
    currentPrediction: 'NEUTRAL',
    currentConfidence: 0,
    currentSignals: null,
    cycleStartTime: null,
    entryPrice: null,
    history: [],
    correct: 0,
    wrong: 0,
    skipped: 0,
    aiVerdict: null,
    openPosition: null,
  } as any;`);

// 2. Fix lines 293: error TS2339: Property 'history' does not exist on type 'PredictorState'.
content = content.replace(/const decided = store\.history\.filter/g, `const decided = symStateActive?.history?.filter`);

// 3. Fix line 305: error TS2304: Cannot find name 'symStateActive'.
// Let's check where symStateActive is missing.
content = content.replace(/const totalNetPct = store\.history\.reduce/g, `const totalNetPct = symStateActive?.history?.reduce`);
content = content.replace(/if \(store\.history\.length > 0\) \{/g, `if (symStateActive?.history?.length > 0) {`);

// 4. Fix line 1206: PredictorPerformanceDashboardProps missing symbol
content = content.replace(/<PredictorPerformanceDashboard history=\{symState\.history\} \/>/g, `<PredictorPerformanceDashboard symbol={symbol} history={symState.history} />`);

fs.writeFileSync(file, content);
