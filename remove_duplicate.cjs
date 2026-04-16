const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
const lines = c.split('\n');

// Find line index where old modal starts (second occurrence of {showAgreementModal &&)
let count = 0;
let oldStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{showAgreementModal && (')) {
    count++;
    if (count === 2) { oldStart = i; break; }
  }
}
if (oldStart === -1) { console.log('Old modal not found'); process.exit(1); }

// Find where it ends - look for the closing )} followed by two </div>
let endIdx = -1;
for (let i = oldStart + 1; i < lines.length; i++) {
  if (lines[i].trim() === ')}' && i + 1 < lines.length && lines[i+1].trim() === '</div>') {
    endIdx = i + 1; // include the closing line
    break;
  }
}
if (endIdx === -1) { console.log('End not found'); process.exit(1); }

console.log('Removing lines', oldStart + 1, 'to', endIdx + 1, '(1-indexed)');
console.log('Line', oldStart+1, ':', lines[oldStart].trim().substring(0,60));
console.log('Line', endIdx+1, ':', lines[endIdx].trim());

// Remove those lines
const newLines = [...lines.slice(0, oldStart), ...lines.slice(endIdx + 1)];
fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', newLines.join('\n'), 'utf8');
console.log('Done. File now has', newLines.length, 'lines');

// Verify - should only have one modal
const v = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
const modalCount = (v.match(/{showAgreementModal && \(\n/g) || []).length;
console.log('Modal count in file:', modalCount);
console.log('Has onScrollToBottom in modal:', v.includes('onScrollToBottom'));
console.log('Has embedded={true} without onScrollToBottom:', v.includes('<Agreement embedded={true}'));
