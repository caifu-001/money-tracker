const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// 找到目标字节位置
const idx = c.indexOf('// 首次点击：弹出协议窗口，引导阅读');
console.log('idx:', idx);
const chunk = c.substring(idx - 80, idx + 280);
console.log('chunk:', JSON.stringify(chunk));
// 用精确字节范围替换
const start = idx - 20;
const end = idx + 270;
const before = c.substring(0, start);
const after = c.substring(end);
// 新的 button onClick（保持原始缩进）
const newChunk = ` if (!agreedAgreement) {
                          e.stopPropagation()
                          setAgreementType('agreement')
                          setAgreementScrolled(false)
                          setShowAgreementModal(true)
                        } else {
                          setAgreedAgreement(false)
                        }`;
c = before + newChunk + after;
console.log('Fix 1 done');
fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('saved');
