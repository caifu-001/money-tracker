const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// ===== FIX 1: button onClick 加 e.stopPropagation() =====
const target1 = `                      onClick={() => {
                        if (!agreedAgreement) {
                          // 首次点击：弹出协议窗口，引导阅读
                          setAgreementType('agreement')
                          setAgreementScrolled(false)
                          setShowAgreementModal(true)
                        } else {
                          setAgreedAgreement(false)
                        }
                      }}`;
const repl1 = `                      onClick={(e) => {
                        e.stopPropagation()
                        if (!agreedAgreement) {
                          setAgreementType('agreement')
                          setAgreementScrolled(false)
                          setShowAgreementModal(true)
                        } else {
                          setAgreedAgreement(false)
                        }
                      }}`;
if (c.includes(target1)) { c = c.replace(target1, repl1); console.log('1: button stopPropagation OK') }
else { console.log('1: FAILED - pattern not found'); process.exit(1) }

// ===== FIX 2: outer div 加 onClick（只在未同意时触发）=====
const target2 = `                  <div style={{
                    display:'flex', alignItems:'flex-start', gap:'10px',
                    background: agreedAgreement ? '#f0fdf4' : '#fffbeb',
                    border: agreedAgreement ? '1.5px solid #bbf7d0' : '1.5px solid #fde68a',
                    borderRadius:'12px', padding:'12px'
                  }}>
                    <button
                      type="button"
                      onClick={`;
const repl2 = `                  <div style={{
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
                    <button
                      type="button"
                      onClick={`;
if (c.includes(target2)) { c = c.replace(target2, repl2); console.log('2: div onClick OK') }
else { console.log('2: FAILED'); process.exit(1) }

// ===== FIX 3: throw Error -> alert ======
const oldThrow = `if (!agreedAgreement) throw new Error('请先阅读并同意用户协议和隐私政策')`;
const newThrow = `if (!agreedAgreement) { alert('请先勾选"我已阅读并同意用户协议和隐私政策"'); return }`;
if (c.includes(oldThrow)) { c = c.replace(oldThrow, newThrow); console.log('3: throw->alert OK') }
else { console.log('3: FAILED - throw not found'); process.exit(1) }

// ===== FIX 4: 登录页底部版本号 ======
const oldBrand = `          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'16px' }}>`;
const newBrand = `          {/* 版本号 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.45)', fontSize:'12px', marginTop:'4px' }}>游游记账 v3.0.3 · 游游工作室</p>
          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'8px' }}>`;
if (c.includes(oldBrand)) { c = c.replace(oldBrand, newBrand); console.log('4: version OK') }
else { console.log('4: FAILED - brand not found'); process.exit(1) }

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('App.tsx saved OK');
