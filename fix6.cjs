const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
let changes = 0;

// FIX 2: outer div 加 onClick
const divTarget = `<div style={{
                    display:'flex', alignItems:'flex-start', gap:'10px',
                    background: agreedAgreement ? '#f0fdf4' : '#fffbeb',
                    border: agreedAgreement ? '1.5px solid #bbf7d0' : '1.5px solid #fde68a',
                    borderRadius:'12px', padding:'12px'
                  }}>
                    <button`;
const divReplacement = `<div style={{
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
if (c.includes(divTarget)) { c = c.replace(divTarget, divReplacement); changes++; console.log('Fix 2: div onClick') } 
else { console.log('Fix 2: skip - not found') }

// FIX 3: throw Error -> alert
const oldThrow = `if (!agreedAgreement) throw new Error('请先阅读并同意用户协议和隐私政策')`;
const newThrow = `if (!agreedAgreement) { alert('请先勾选"我已阅读并同意用户协议和隐私政策"'); return }`;
if (c.includes(oldThrow)) { c = c.replace(oldThrow, newThrow); changes++; console.log('Fix 3: throw -> alert') }
else { console.log('Fix 3: throw already replaced or not found') }

// FIX 4: 版本号
const brandTarget = `          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'16px' }}>`;
const brandReplacement = `          {/* 版本号 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.45)', fontSize:'12px', marginTop:'4px' }}>游游记账 v3.0.3 · 游游工作室</p>
          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'8px' }}>`;
if (c.includes(brandTarget)) { c = c.replace(brandTarget, brandReplacement); changes++; console.log('Fix 4: version') }
else { console.log('Fix 4: brand not found, checking alternatives...'); 
  // Try without the comment
  if (c.includes("color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'16px'")) {
    c = c.replace(
      `<p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'16px' }}>`,
      `<p style={{ textAlign:'center', color:'rgba(255,255,255,0.45)', fontSize:'12px', marginTop:'4px' }}>游游记账 v3.0.3 · 游游工作室</p>\r\n          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'8px' }}>`
    );
    changes++;
    console.log('Fix 4: version (alt)');
  }
}

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('App.tsx done, changes:', changes);

// ===== Admin.tsx =====
const admin = 'D:/1kaifa/money-tracker/src/pages/Admin.tsx';
let a = fs.readFileSync(admin, 'utf8');
let aChanges = 0;

if (!a.includes('showAbout') || !a.includes('AboutSection')) {
  // 添加 showAbout state
  if (!a.includes('const [showAbout')) {
    const idx2 = a.indexOf('const [activeTab, setActiveTab]');
    if (idx2 >= 0) {
      a = a.substring(0, idx2) + 'const [showAbout, setShowAbout] = useState(false)\r\n  ' + a.substring(idx2);
      aChanges++;
      console.log('Admin: showAbout state added');
    }
  }

  // 在 export 之前插入 AboutSection 组件
  const expIdx = a.indexOf('export default Admin');
  if (expIdx > 0) {
    const aboutSection = `

function AboutSection({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'about'|'agreement'|'privacy'>('about')
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300}} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:'white',borderRadius:'20px',width:'90%',maxWidth:'400px',maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 50px rgba(0,0,0,0.25)',overflow:'hidden'}}>
        <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:'16px',fontWeight:700,color:'#1f2937'}}>📖 关于系统</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'20px',color:'#9ca3af',padding:'4px'}}>✕</button>
        </div>
        <div style={{display:'flex',borderBottom:'1px solid #f3f4f6',flexShrink:0}}>
          {(['about','agreement','privacy'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{flex:1,padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:tab===t?700:400,color:tab===t?'#6366f1':'#9ca3af',borderBottom:tab===t?'2px solid #6366f1':'2px solid transparent'}}>
              {t==='about'?'关于':t==='agreement'?'用户协议':'隐私政策'}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px',fontSize:'13px',color:'#4b5563',lineHeight:'1.9'}}>
          {tab==='about' && (
            <div>
              <div style={{textAlign:'center',marginBottom:'20px'}}>
                <div style={{fontSize:'40px',marginBottom:'8px'}}>💰</div>
                <h2 style={{fontSize:'18px',fontWeight:800,color:'#1f2937',margin:'0 0 4px'}}>游游记账</h2>
                <p style={{color:'#6366f1',fontSize:'14px',fontWeight:600}}>Version 3.0.3</p>
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
        <div style={{padding:'14px 20px 18px',textAlign:'center',borderTop:'1px solid #f3f4f6'}}>
          <p style={{color:'#9ca3af',fontSize:'12px',margin:'0'}}>游游记账 v3.0.3 · 游游工作室</p>
        </div>
      </div>
    </div>
  )
}

`;
    a = a.substring(0, expIdx) + aboutSection + a.substring(expIdx);
    aChanges++;
    console.log('Admin: AboutSection added');
  }

  // 在 Admin 组件底部（倒数第1个 </div> 前）插入弹窗
  if (!a.includes('AboutSection onClose')) {
    const lastClose = a.lastIndexOf('</div>');
    if (lastClose > 0) {
      a = a.substring(0, lastClose) + '{showAbout && <AboutSection onClose={()=>setShowAbout(false)} />}\r\n' + a.substring(lastClose);
      aChanges++;
      console.log('Admin: AboutSection render added');
    }
  }

  // 版本号
  if (!a.includes('v3.0.3')) {
    a = a.replace(/(export default Admin)/,
      '<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"20px"}}>游游记账 v3.0.3 · 游游工作室</p>\r\n$1');
    aChanges++;
    console.log('Admin: version added');
  }

  // 关于系统链接
  if (!a.includes('关于系统')) {
    a = a.replace(/(export default Admin)/,
      '<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"12px",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setShowAbout(true)}>关于系统</p>\r\n$1');
    aChanges++;
    console.log('Admin: 关于系统 button added');
  }

  fs.writeFileSync(admin, a, 'utf8');
  console.log('Admin.tsx saved, changes:', aChanges);
} else {
  console.log('Admin.tsx already has AboutSection');
}

console.log('All done!');
