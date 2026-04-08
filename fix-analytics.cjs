const fs = require('fs');
let c = fs.readFileSync('src/pages/Analytics.tsx', 'utf8');

// 1. Add helper functions after COLORS (only once)
const helpersAdded = c.includes('const fmtYuan = (v: any)');
if (!helpersAdded) {
  c = c.replace(
    /(const COLORS = \[[\s\S]*?\])/,
    '$1\n\nconst fmtYuan = (v: any) => `¥${Number(v ?? 0).toFixed(2)}`\nconst fmtInt = (v: any) => `¥${Number(v ?? 0)}`'
  );
}

// 2. Replace all Tooltip formatters
c = c.replace(/formatter=\{\(v: number\) => `¥\$\{v\.toFixed\(2\)\}`\}/g, 'formatter={fmtYuan}');
c = c.replace(/formatter=\{\(v: number\) => `¥\$\{v\}`\}/g, 'formatter={fmtInt}');
c = c.replace(/tickFormatter=\{\(v: number\) => `¥\$\{v\}`\}/g, 'tickFormatter={fmtInt}');

fs.writeFileSync('src/pages/Analytics.tsx', c);
console.log('done, modified:', c.includes('fmtYuan'));
