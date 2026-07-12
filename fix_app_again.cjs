const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf-8');
c = c.replace(/import \{ startBotEngine \} from '\.\/api\/botEngine';\r?\n/g, '');
c = c.replace(/startBotEngine\(\);\r?\n/g, '');

fs.writeFileSync('src/App.tsx', c);
console.log('App.tsx patched!');
