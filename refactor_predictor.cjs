const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'BtcPredictor.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add symState definition right after usePredictorStore hook
const usePredictorStoreHook = `const predictor = usePredictorStore();`;
const symStateDecl = `
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
  } as any;
`;
if (!content.includes('const symState = predictor.symbols')) {
  content = content.replace(usePredictorStoreHook, usePredictorStoreHook + symStateDecl);
}

// 2. Replace predictor.prop with symState.prop for state variables
const stateProps = [
  'currentPrediction', 'currentConfidence', 'currentSignals', 'cycleStartTime',
  'entryPrice', 'history', 'correct', 'wrong', 'skipped', 'aiVerdict', 'openPosition'
];
for (const prop of stateProps) {
  const regex = new RegExp(`predictor\\.${prop}`, 'g');
  content = content.replace(regex, `symState.${prop}`);
}

// 3. Update predictor store action calls to pass symbol
content = content.replace(/predictor\.setCurrentPrediction\(/g, 'predictor.setCurrentPrediction(symbol, ');
content = content.replace(/predictor\.resolvePrediction\(/g, 'predictor.resolvePrediction(symbol, ');
content = content.replace(/predictor\.addHistoryEntry\(/g, 'predictor.addHistoryEntry(symbol, ');
content = content.replace(/predictor\.setAiVerdict\(/g, 'predictor.setAiVerdict(symbol, ');
content = content.replace(/predictor\.setOpenPosition\(/g, 'predictor.setOpenPosition(symbol, ');

// 4. Update the imperative code in the tick loop
content = content.replace(
  /const store = usePredictorStore\.getState\(\);\s*const head = store\.history\[0\];/g,
  `const store = usePredictorStore.getState();
      const symStateActive = store.symbols[cfgRef.current.symbol];
      const head = symStateActive?.history?.[0];`
);

content = content.replace(
  /store\.resolvePrediction\(head\.id/g,
  `store.resolvePrediction(cfgRef.current.symbol, head.id`
);

content = content.replace(
  /const openPos = store\.openPosition;/g,
  `const openPos = symStateActive?.openPosition;`
);

content = content.replace(
  /store\.setOpenPosition\(/g,
  `store.setOpenPosition(cfgRef.current.symbol, `
);

content = content.replace(
  /store\.setCurrentPrediction\(/g,
  `store.setCurrentPrediction(cfgRef.current.symbol, `
);

content = content.replace(
  /store\.setAiVerdict\(/g,
  `store.setAiVerdict(cfgRef.current.symbol, `
);

content = content.replace(
  /store\.addHistoryEntry\(/g,
  `store.addHistoryEntry(cfgRef.current.symbol, `
);

fs.writeFileSync(file, content);
console.log('Done replacing in BtcPredictor.tsx');
