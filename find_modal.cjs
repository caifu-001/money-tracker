const fs = require('fs');
const c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
const idx = c.indexOf("backdropFilter:'blur(4px)'");
console.log('backdropFilter found at:', idx);
if (idx > -1) {
  // Print 500 chars around it
  const seg = c.substring(idx, idx + 500);
  console.log('Content around backdropFilter:');
  console.log(JSON.stringify(seg));
}
