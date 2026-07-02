const fs = require('fs');
const path = require('path');

function patchAiConsole() {
  const file = path.join(__dirname, 'src', 'pages', 'AiConsole.tsx');
  let content = fs.readFileSync(file, 'utf8');

  // Replace get predictor state
  content = content.replace(
    /const predictor = usePredictorStore\.getState\(\);/g,
    `const store = usePredictorStore.getState();
        const predictor = store.symbols['BTC-USD'] || { currentPrediction: 'NEUTRAL', currentConfidence: 0, currentSignals: null, aiVerdict: null };`
  );

  content = content.replace(
    /const s = usePredictorStore\.getState\(\);/g,
    `const store = usePredictorStore.getState();
        const s = store.symbols['BTC-USD'] || { history: [], correct: 0, wrong: 0, skipped: 0, currentPrediction: 'NEUTRAL', currentConfidence: 0, currentSignals: null, aiVerdict: null, openPosition: null };`
  );

  fs.writeFileSync(file, content);
}

function patchDashboard() {
  const file = path.join(__dirname, 'src', 'pages', 'Dashboard.tsx');
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    /usePredictorStore\(\(s\) => s\.currentSignals\)/g,
    `usePredictorStore((s) => s.symbols['BTC-USD']?.currentSignals ?? null)`
  );
  content = content.replace(
    /usePredictorStore\(\(s\) => s\.currentPrediction\)/g,
    `usePredictorStore((s) => s.symbols['BTC-USD']?.currentPrediction ?? 'NEUTRAL')`
  );
  content = content.replace(
    /usePredictorStore\(\(s\) => s\.aiVerdict\)/g,
    `usePredictorStore((s) => s.symbols['BTC-USD']?.aiVerdict ?? null)`
  );
  content = content.replace(
    /usePredictorStore\(\(s\) => s\.history\)/g,
    `usePredictorStore((s) => s.symbols['BTC-USD']?.history ?? [])`
  );
  content = content.replace(
    /setCurrentPrediction\(result\.direction, result\.confidence, result\.signals, result\.price\);/g,
    `setCurrentPrediction('BTC-USD', result.direction, result.confidence, result.signals, result.price);`
  );

  fs.writeFileSync(file, content);
}

function patchTelegramIntegration() {
  const file = path.join(__dirname, 'src', 'pages', 'TelegramIntegration.tsx');
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
      /usePredictorStore\.getState\(\)\.aiVerdict/g,
      `usePredictorStore.getState().symbols['BTC-USD']?.aiVerdict`
    );
    fs.writeFileSync(file, content);
  }
}

function patchBtcPredictorErrors() {
  const file = path.join(__dirname, 'src', 'pages', 'BtcPredictor.tsx');
  let content = fs.readFileSync(file, 'utf8');
  // Error: Block-scoped variable 'symbol' used before its declaration.
  // Move symState declaration AFTER symbol is extracted from URL/state, or just define it in the component body
  
  // It looks like I inserted symStateDecl too early in the file, before `symbol` prop or state.
  // I will just change it to use predictor.symbols[symbol] directly or fix its position.
  
  // Let's remove the global one and place it right before useMemo
  content = content.replace(/const symState \= predictor\.symbols\[symbol\][\s\S]*?\} as any;/m, '');
  
  content = content.replace(/const predictor = usePredictorStore\(\);/, 
  `const predictor = usePredictorStore();
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
  } as any;`
  );
  
  content = content.replace(/const store = usePredictorStore.getState\(\);\s*const symStateActive = store\.symbols\[cfgRef\.current\.symbol\];/g, 
  `const store = usePredictorStore.getState();
      const symStateActive = store.symbols[cfgRef.current.symbol] || { history: [], openPosition: null } as any;`);
  
  fs.writeFileSync(file, content);
}

patchAiConsole();
patchDashboard();
patchTelegramIntegration();
patchBtcPredictorErrors();
console.log('Patched');
