const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.tsx');
let appContent = fs.readFileSync(appPath, 'utf8');

// Find the exact useEffect and replace it
const target = `  useEffect(() => {
    preloadCommonPages();
  }, []);`;

const replacement = `  useEffect(() => {
    preloadCommonPages();
    startWave3Engine();
  }, []);`;

appContent = appContent.replace(target, replacement);
fs.writeFileSync(appPath, appContent);

const tbPath = path.join(__dirname, 'src', 'pages', 'TradingBots.tsx');
let tbContent = fs.readFileSync(tbPath, 'utf8');
tbContent = tbContent.replace(/import React, \{ useEffect, useState \} from 'react';/, "import React, { useState } from 'react';");
fs.writeFileSync(tbPath, tbContent);

console.log("Patched unused imports!");
