const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
// Fix: after the modal's )}, insert the missing </div>
c = c.replace(
  "      )}\r\n  )\r\n}\r\n\r\nexport default App",
  "      )}\r\n    </div>\r\n  )\r\n}\r\n\r\nexport default App"
);
fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('Fixed. Checking...');
const v = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
console.log('Ends with:', JSON.stringify(v.slice(-80)));
console.log('Line count:', v.split('\n').length);
