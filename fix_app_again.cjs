const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

if (!c.includes('import { startWave3Engine }')) {
  c = c.replace(
    "import { startDemoEngine, stopDemoEngine } from './api/demoEngine';",
    "import { startDemoEngine, stopDemoEngine } from './api/demoEngine';\nimport { startWave3Engine } from './api/wave3Engine';"
  );
}

if (!c.includes('startWave3Engine();')) {
  c = c.replace('preloadCommonPages();', 'preloadCommonPages();\n    startWave3Engine();');
}

fs.writeFileSync('src/App.tsx', c);
console.log('App.tsx fixed');
