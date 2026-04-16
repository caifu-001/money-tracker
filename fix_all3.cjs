const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// FIX 1: button onClick 加 stopPropagation
const oldButton = `                      onClick={() => {
                        if (!agreedAgreement) {
                          // 首次点击：弹出协议窗口，引导阅读
                          setAgreementType('agreement')
                          setAgreementScrolled(false)
                          setShowAgreementModal(true)
                        } else {
                          setAgreedAgreement(false)
                        }
                      }}`;
const newButton = `                      onClick={(e) => {
                        e.stopPropagation()
                        if (!agreedAgreement) {
                          setAgreementType('agreement')
                          setAgreementScrolled(false)
                          setShowAgreementModal(true)
                        } else {
                          setAgreedAgreement(false)
                        }
                      }}`;
if (!c.includes(oldButton)) {
  console.log('ERROR: button onClick pattern not found');
  process.exit(1);
}
c = c.replace(oldButton, newButton);
console.log('Fix 1: stopPropagation on button');

// FIX 2: outer div 加 onClick（只在未同意时打开协议）
const oldDiv = `                  <div style={{
                    display:'flex', alignItems:'flex-start', gap:'10px',
                    background: agreedAgreement ? '#f0fdf4' : '#fffbeb',
                    border: agreedAgreement ? '1.5px solid #bbf7d0' : '1.5px solid #fde68a',
                    borderRadius:'12px', padding:'12px'
                  }}>
                    <button`;
const newDiv = `                  <div style={{
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
c = c.replace(oldDiv, newDiv);
console.log('Fix 2: div onClick added');

// FIX 3: signup throw Error 改为 alert
c = c.replace(
  `if (!agreedAgreement) throw new Error('请先阅读并同意用户协议和隐私政策')`,
  `if (!agreedAgreement) { alert('请先勾选"我已阅读并同意用户协议和隐私政策"'); return }`
);
console.log('Fix 3: throw Error -> alert');

// FIX 4: 登录页底部版本号
const oldBrand = `          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'16px' }}>`;
const newBrand = `          {/* 版本号 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.45)', fontSize:'12px', marginTop:'4px' }}>游游记账 v3.0.3 · 游游工作室</p>
          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'8px' }}>`;
if (c.includes(oldBrand)) {
  c = c.replace(oldBrand, newBrand);
  console.log('Fix 4: login version added');
} else {
  console.log('Fix 4: brand not found');
}

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('App.tsx saved.');

// ===== Admin.tsx =====
const admin = 'D:/1kaifa/money-tracker/src/pages/Admin.tsx';
let a = fs.readFileSync(admin, 'utf8');

if (!a.includes('showAbout') || !a.includes('AboutSection')) {
  // 添加 state
  if (!a.includes('const [showAbout')) {
    a = a.replace(
      /(const \[activeTab, setActiveTab\] = useState<[^>]+>)/,
      'const [showAbout, setShowAbout] = useState(false)\r\n  $1'
    );
  }

  const expIdx = a.indexOf('export default Admin');
  if (expIdx > 0) {
    const aboutSection = `

// 关于系统弹窗
function AboutSection({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'about'|'agreement'|'privacy'>('about')
  return (
    <div style={{
      position:'fixed',top:0,left:0,right:0,bottom:0,
      background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:300
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'white',borderRadius:'20px',width:'90%',maxWidth:'400px',
        maxHeight:'80vh',display:'flex',flexDirection:'column',
        boxShadow:'0 20px 50px rgba(0,0,0,0.25)',overflow:'hidden'
      }}>
        <div style={{ padding:'18px 20px 14px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <span style={{ fontSize:'16px',fontWeight:700,color:'#1f2937' }}>📖 关于系统</span>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'20px',color:'#9ca3af',padding:'4px' }}>✕</button>
        </div>
        <div style={{ display:'flex',borderBottom:'1px solid #f3f4f6',flexShrink:0 }}>
          {(['about','agreement','privacy'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1,padding:'10px',background:'none',border:'none',cursor:'pointer',
              fontSize:'13px',fontWeight:tab===t?700:400,
              color:tab===t?'#6366f1':'#9ca3af',
              borderBottom:tab===t?'2px solid #6366f1':'2px solid transparent',
              transition:'all 0.15s'
            }}>{t==='about'?'关于':t==='agreement'?'用户协议':'隐私政策'}</button>
          ))}
        </div>
        <div style={{ flex:1,overflowY:'auto',padding:'20px',fontSize:'13px',color:'#4b5563',lineHeight:'1.9' }}>
          {tab==='about' && (
            <div>
              <div style={{ textAlign:'center',marginBottom:'20px' }}>
                <div style={{ fontSize:'40px',marginBottom:'8px' }}>💰</div>
                <h2 style={{ fontSize:'18px',fontWeight:800,color:'#1f2937',margin:'0 0 4px' }}>游游记账</h2>
                <p style={{ color:'#6366f1',fontSize:'14px',fontWeight:600 }}>Version 3.0.3</p>
              </div>
              <p style={{marginBottom:'10px'}}>游游记账是一款简洁高效的<strong>家庭协同记账应用</strong>，支持多账本管理、分类统计、预算控制和数据导入导出。</p>
              <p style={{marginBottom:'10px'}}>支持网页版和小程序双端使用，数据实时同步，随时随地管理家庭财务。</p>
              <p>由 <strong>游游工作室</strong> 开发维护 · 2026</p>
            </div>
          )}
          {tab==='agreement' && (
            <div>
              <h3 style={{fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px'}}>用户协议</h3>
              <p style={{marginBottom:'8px'}}>1. 使用本应用即表示您同意以下条款。</p>
              <p style={{marginBottom:'8px'}}>2. 请勿使用本应用从事违法活动。</p>
              <p style={{marginBottom:'8px'}}>3. 注册后需管理员审核通过方可使用完整功能。</p>
              <p style={{marginBottom:'8px'}}>4. 用户数据归用户本人所有，平台不会用于商业目的。</p>
              <p>5. 如有疑问请联系管理员。</p>
            </div>
          )}
          {tab==='privacy' && (
            <div>
              <h3 style={{fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px'}}>隐私政策</h3>
              <p style={{marginBottom:'8px'}}>1. 我们收集您注册时提供的邮箱、昵称信息。</p>
              <p style={{marginBottom:'8px'}}>2. 记账数据仅用于生成报表和统计分析。</p>
              <p style={{marginBottom:'8px'}}>3. 账户注销后15个工作日内删除全部个人数据。</p>
              <p style={{marginBottom:'8px'}}>4. 您的数据存储在中华人民共和国境内服务器。</p>
              <p>5. 如有隐私问题请联系管理员。</p>
            </div>
          )}
        </div>
        <div style={{ padding:'14px 20px 18px',textAlign:'center',borderTop:'1px solid #f3f4f6' }}>
          <p style={{color:'#9ca3af',fontSize:'12px',margin:'0'}}>游游记账 v3.0.3 · 游游工作室</p>
        </div>
      </div>
    </div>
  )
}

`;
    a = a.substring(0, expIdx) + aboutSection + a.substring(expIdx);
  }

  // 在 Admin 组件底部（倒数第2个 </div> 前）插入弹窗
  if (!a.includes('AboutSection onClose')) {
    const lastClose = a.lastIndexOf('</div>');
    if (lastClose > 0) {
      a = a.substring(0, lastClose) + '{showAbout && <AboutSection onClose={()=>setShowAbout(false)} />}\r\n' + a.substring(lastClose);
    }
  }

  // 在 export 之前加版本号和"关于系统"链接
  if (!a.includes('v3.0.3')) {
    a = a.replace(
      /(export default Admin)/,
      '<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"20px"}}>游游记账 v3.0.3 · 游游工作室</p>\r\n$1'
    );
  }
  if (!a.includes('关于系统')) {
    a = a.replace(
      /(export default Admin)/,
      '<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"12px",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setShowAbout(true)}>关于系统</p>\r\n$1'
    );
  }

  fs.writeFileSync(admin, a, 'utf8');
  console.log('Admin.tsx updated');
}

console.log('All done!');
