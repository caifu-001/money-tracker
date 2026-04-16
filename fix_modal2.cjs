const fs = require('fs');
const c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// Step 1: backdrop层加onClick关闭
let content = c.replace(
  "backdropFilter:'blur(4px)'\r\n        }}>\r\n          <div style={{",
  "backdropFilter:'blur(4px)'\r\n        }}\r\n          onClick={() => setShowAgreementModal(false)}>\r\n          <div onClick={e => e.stopPropagation()} style={{"
);

// Step 2: 内容区的onScroll和onClick删掉
content = content.replace(
  "              onScroll={e => { if ((e.target as HTMLDivElement).scrollHeight - (e.target as HTMLDivElement).scrollTop <= (e.target as HTMLDivElement).clientHeight + 20) setAgreementScrolled(true) }}\r\n              onClick={() => setAgreementScrolled(true)}\r\n              style={{ flex:1,overflowY:'auto',padding:'16px 20px',fontSize:'13px',color:'#4b5563',lineHeight:'1.8',cursor: agreementScrolled ? 'default' : 'default' }}",
  "              style={{ flex:1,overflowY:'auto' }}"
);

// Step 3: 按钮文字改完整
content = content.replace(
  "                    已阅读并同意",
  "                    我已阅读并同意以上协议"
);

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', content, 'utf8');
console.log('Done. Checking result...');

// Verify
const c2 = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
console.log('Has onClick stopPropagation:', c2.includes('e.stopPropagation'));
console.log('Has backdrop onClick:', c2.includes("onClick={() => setShowAgreementModal(false)}"));
console.log('Removed onScroll:', !c2.includes('onScroll={e => { if'));
console.log('Button text:', c2.includes('我已阅读并同意以上协议'));
