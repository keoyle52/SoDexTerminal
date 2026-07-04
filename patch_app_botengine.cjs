const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

if (!c.includes('import { startBotEngine }')) {
  c = c.replace(
    "import { startWave3Engine } from './api/wave3Engine';",
    "import { startWave3Engine } from './api/wave3Engine';\nimport { startBotEngine } from './api/botEngine';"
  );
}

if (!c.includes('startBotEngine();')) {
  c = c.replace('startWave3Engine();', 'startWave3Engine();\n    startBotEngine();');
}

fs.writeFileSync('src/App.tsx', c);
console.log('App.tsx updated');
