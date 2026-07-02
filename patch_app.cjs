const fs = require('fs');
const path = require('path');

const appTsx = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(appTsx, 'utf8');

if (!content.includes('startWave3Engine')) {
  content = content.replace(
    /import \{ startDemoEngine, stopDemoEngine \} from '\.\/api\/demoEngine';/,
    "import { startDemoEngine, stopDemoEngine } from './api/demoEngine';\nimport { startWave3Engine } from './api/wave3Engine';"
  );
  
  content = content.replace(
    /useEffect\(\(\) => \{\n    preloadCommonPages\(\);\n  \}, \[\]\);/,
    "useEffect(() => {\n    preloadCommonPages();\n    startWave3Engine();\n  }, []);"
  );
  fs.writeFileSync(appTsx, content);
}
