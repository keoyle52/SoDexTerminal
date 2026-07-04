const fs = require('fs');
let c = fs.readFileSync('src/api/botEngine.ts', 'utf8');

// Fix ERROR -> WARNING
c = c.replace(/'ERROR'/g, "'WARNING'");

// Fix the fetchBookTickers `any` mapping issue where `b.symbol` is typed as unknown
c = c.replace(/const book = books\.find\(\(b: any\) => b\.symbol === bs\.marketMakerBot\.symbol\);/, `const book = (books as any[]).find((b: any) => b.symbol === bs.marketMakerBot.symbol);`);

fs.writeFileSync('src/api/botEngine.ts', c);
