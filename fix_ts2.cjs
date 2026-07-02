const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'BtcPredictor.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const head = store\.history\[0\];/g,
  `const symStateActive = store.symbols[cfgRef.current.symbol] || { history: [], openPosition: null } as any;
      const head = symStateActive.history[0];`
);

fs.writeFileSync(file, content);
console.log('Fixed head history reference');
