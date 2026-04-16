const fs = require('fs');
let c = fs.readFileSync('src/pages/Categories.tsx', 'utf8');
c = c.replace(/暂无\{t === 'expense' \? '支出' : '收入'\}/g, '暂无{tab === "expense" ? "支出" : "收入"}');
fs.writeFileSync('src/pages/Categories.tsx', c);
console.log('done');
