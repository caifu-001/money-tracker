const fs = require('fs');
// Restore first
const { execSync } = require('child_process');
try {
  execSync('git checkout -- src/pages/Admin.tsx', { cwd: 'D:/1kaifa/money-tracker' });
  console.log('Admin.tsx restored');
} catch(e) { console.log('restore error:', e.message); }

let a = fs.readFileSync('D:/1kaifa/money-tracker/src/pages/Admin.tsx', 'utf8');
const expIdx = a.indexOf('export default Admin');
console.log('export at:', expIdx);
if (expIdx < 0) { console.log('STILL NO EXPORT'); process.exit(1) }
console.log('Admin.tsx OK, length:', a.length);
