const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// FIX 1: button onClick - 用索引直接替换
const target = `                        if (!agreedAgreement) {
                          // 首次点击：弹出协议窗口，引导阅读
                          setAgreementType('agreement')
                          setAgreementScrolled(false)
                          setShowAgreementModal(true)
                        } else {
                          setAgreedAgreement(false)
                        }`;
const replacement = `                        if (!agreedAgreement) {
                          e.stopPropagation()
                          setAgreementType('agreement')
                          setAgreementScrolled(false)
                          setShowAgreementModal(true)
                        } else {
                          setAgreedAgreement(false)
                        }`;

if (!c.includes(target)) {
  console.log('ERROR: target not found');
  process.exit(1);
}
c = c.replace(target, replacement);
console.log('Fix 1: stopPropagation added');

// FIX 2: outer div 加 onClick（只在未同意时生效）
const divTarget = `                  <div style={{
                    display:'flex', alignItems:'flex-start', gap:'10px',
                    background: agreedAgreement ? '#f0fdf4' : '#fffbeb',
                    border: agreedAgreement ? '1.5px solid #bbf7d0' : '1.5px solid #fde68a',
                    borderRadius:'12px', padding:'12px'
                  }}>
                    <button`;
const divReplacement = `                  <div style={{
                    display:'flex', alignItems:'flex-start', gap:'10px',
                    background: agreedAgreement ? '#f0fdf4' : '#fffbeb',
                    border: agreedAgreement ? '1.5px solid #bbf7d0' : '1.5px solid #fde68a',
                    borderRadius:'12px', padding:'12px',
                    cursor:'pointer'
                  }}
                    onClick={() => {
                      if (!agreedAgreement) {
                        setAgreementType('agreement')
                        setAgreementScrolled(false)
                        setShowAgreementModal(true)
                      }
                    }}>
                    <button`;
if (c.includes(divTarget)) {
  c = c.replace(divTarget, divReplacement);
  console.log('Fix 2: div onClick added');
} else {
  console.log('Fix 2: div target not found');
}

// FIX 3: signup throw Error
c = c.replace(
  `if (!agreedAgreement) throw new Error('请先阅读并同意用户协议和隐私政策')`,
  `if (!agreedAgreement) { alert('请先勾选"我已阅读并同意用户协议和隐私政策"'); return }`
);
console.log('Fix 3: throw -> alert');

// FIX 4: 版本号
if (c.includes('底部品牌')) {
  c = c.replace(
    `          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'16px' }}>`,
    `          {/* 版本号 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.45)', fontSize:'12px', marginTop:'4px' }}>游游记账 v3.0.3 · 游游工作室</p>
          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'8px' }}>`
  );
  console.log('Fix 4: version added');
}

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('App.tsx saved.');
