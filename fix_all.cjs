const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// ===== FIX 1: handleAuth - preventDefault 代替 throw Error，让 React 先更新 agreedAgreement =====
const oldHandleAuth = `const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (lockUntil && Date.now() < lockUntil) return
    if (!agreedAgreement) throw new Error('请先阅读并同意用户协议和隐私政策')`;
const newHandleAuth = `const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (lockUntil && Date.now() < lockUntil) return
    // 注册时：先检查协议同意状态（防止 checkbox 点击时 state 还未更新的竞态）
    if (authMode === 'signup' && !agreedAgreement) {
      alert('请先勾选"我已阅读并同意用户协议和隐私政策"')
      return
    }`;
if (!c.includes(oldHandleAuth)) {
  console.log('ERROR: handleAuth pattern not found. Trying simpler search...');
  // Try to find the function and see what's there
  const idx = c.indexOf("if (!agreedAgreement) throw new Error");
  if (idx >= 0) {
    console.log('Found at idx', idx, ':', JSON.stringify(c.substring(idx-50, idx+100)));
  }
  process.exit(1);
}
c = c.replace(oldHandleAuth, newHandleAuth);
console.log('Fix 1 applied: handleAuth preventDefault');

// ===== FIX 2: 注册页底部版本号（登录页）=====
// 在品牌版权行之前加入版本号
const oldBrand = `          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'16px' }}>`;
const newBrand = `          {/* 版本号 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.45)', fontSize:'12px', marginTop:'8px' }}>游游记账 v3.0.3 · 游游工作室</p>
          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'8px' }}>`;
c = c.replace(oldBrand, newBrand);
console.log('Fix 2 applied: login page version number');

// ===== FIX 3: Admin 页面版本号（如果有的话）=====
// 检查 Admin.tsx 里是否已有版本号，没有就加
const adminFile = 'D:/1kaifa/money-tracker/src/pages/Admin.tsx';
if (fs.existsSync(adminFile)) {
  let admin = fs.readFileSync(adminFile, 'utf8');
  if (!admin.includes('v3.0.3')) {
    // 在 footer 或品牌文字附近加入版本号
    if (admin.includes("游游记账") && !admin.includes("v3.0.3")) {
      admin = admin.replace(
        /(<div[^>]*style=\{[^}]*footer[^}]*\}[^>]*>[\s\S]*?)(<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/,
        '$1<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"24px"}}>游游记账 v3.0.3 · 游游工作室</p>$2'
      );
    }
    // 更简单：在最后加一行
    if (!admin.includes('v3.0.3')) {
      admin = admin.replace(
        /(<\/div>\s*\)\s*\}\s*export default Admin\s*)$/,
        '<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"24px"}}>游游记账 v3.0.3 · 游游工作室</p>\r\n$1'
      );
    }
    fs.writeFileSync(adminFile, admin, 'utf8');
    console.log('Fix 3 applied: Admin page version number');
  } else {
    console.log('Fix 3: Admin already has v3.0.3');
  }
}

// ===== FIX 4: Admin 页面加"关于系统"入口 =====
// 在管理页面底部或设置区域加入关于入口
const adminFile2 = 'D:/1kaifa/money-tracker/src/pages/Admin.tsx';
let admin2 = fs.readFileSync(adminFile2, 'utf8');

// 找 footer 或 About 相关区域
if (!admin2.includes('关于系统') && !admin2.includes('About')) {
  // 在 Admin 页面底部（在 export default Admin 之前）加关于区域
  // 查找 "export default Admin" 的位置
  const expIdx = admin2.indexOf('export default Admin');
  if (expIdx > 0) {
    // 在其前面插入关于入口
    const aboutSection = `

// 关于系统
function AboutSection({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'about'|'license'|'privacy'>('about')
  return (
    <div style={{
      position:'fixed',top:0,left:0,right:0,bottom:0,
      background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:300
    }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'white',borderRadius:'20px',width:'90%',maxWidth:'400px',
        maxHeight:'80vh',display:'flex',flexDirection:'column',
        boxShadow:'0 20px 50px rgba(0,0,0,0.3)',overflow:'hidden'
      }}>
        {/* 标题栏 */}
        <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid #f3f4f6', display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <span style={{ fontSize:'16px',fontWeight:700,color:'#1f2937' }}>📖 关于系统</span>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'20px',color:'#9ca3af',padding:'4px' }}>✕</button>
        </div>
        {/* Tab 切换 */}
        <div style={{ display:'flex',borderBottom:'1px solid #f3f4f6',flexShrink:0 }}>
          {(['about','license','privacy'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex:1,padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:activeTab===tab?700:400,
              color:activeTab===tab?'#6366f1':'#9ca3af',borderBottom:activeTab===tab?'2px solid #6366f1':'2px solid transparent',
              transition:'all 0.15s'
            }}>{{ about:'关于',license:'用户协议',privacy:'隐私政策' }[tab]}</button>
          ))}
        </div>
        {/* 内容 */}
        <div style={{ flex:1,overflowY:'auto',padding:'20px',fontSize:'13px',color:'#4b5563',lineHeight:'1.9' }}>
          {activeTab === 'about' && (
            <div>
              <div style={{ textAlign:'center',marginBottom:'20px' }}>
                <div style={{ fontSize:'40px',marginBottom:'8px' }}>💰</div>
                <h2 style={{ fontSize:'18px',fontWeight:800,color:'#1f2937',margin:'0 0 4px' }}>游游记账</h2>
                <p style={{ color:'#6366f1',fontSize:'14px',fontWeight:600 }}>Version 3.0.3</p>
              </div>
              <p style={{ marginBottom:'12px' }}>游游记账是一款简洁高效的<strong>家庭协同记账应用</strong>，支持多账本管理、分类统计、预算控制和数据导入导出。</p>
              <p style={{ marginBottom:'12px' }}>支持网页版和小程序双端使用，数据实时同步，随时随地管理家庭财务。</p>
              <p>由 <strong>游游工作室</strong> 开发维护 · 2026</p>
            </div>
          )}
          {activeTab === 'license' && (
            <div>
              <h3 style={{ fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px' }}>用户协议</h3>
              <p style={{ marginBottom:'10px' }}>1. 使用本应用即表示您同意以下条款。</p>
              <p style={{ marginBottom:'10px' }}>2. 请勿使用本应用从事违法活动。</p>
              <p style={{ marginBottom:'10px' }}>3. 注册后需管理员审核通过方可使用完整功能。</p>
              <p style={{ marginBottom:'10px' }}>4. 用户数据归用户本人所有，平台不会用于商业目的。</p>
              <p>5. 如有疑问请联系管理员。</p>
            </div>
          )}
          {activeTab === 'privacy' && (
            <div>
              <h3 style={{ fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px' }}>隐私政策</h3>
              <p style={{ marginBottom:'10px' }}>1. 我们收集您注册时提供的邮箱、昵称信息。</p>
              <p style={{ marginBottom:'10px' }}>2. 记账数据仅用于生成报表和统计分析。</p>
              <p style={{ marginBottom:'10px' }}>3. 账户注销后15个工作日内删除全部个人数据。</p>
              <p style={{ marginBottom:'10px' }}>4. 您的数据存储在中华人民共和国境内服务器。</p>
              <p>5. 如有隐私问题请联系管理员。</p>
            </div>
          )}
        </div>
        {/* 底部 */}
        <div style={{ padding:'14px 20px 18px',textAlign:'center',borderTop:'1px solid #f3f4f6' }}>
          <p style={{ color:'#9ca3af',fontSize:'12px',margin:'0' }}>游游记账 v3.0.3 · 游游工作室</p>
        </div>
      </div>
    </div>
  )
}

`;
    admin2 = admin2.substring(0, expIdx) + aboutSection + admin2.substring(expIdx);
    fs.writeFileSync(adminFile2, admin2, 'utf8');
    console.log('Fix 4 applied: AboutSection added to Admin');
  }
} else {
  console.log('Fix 4: Admin already has About/关于系统');
}

// ===== FIX 5: Admin 页面显示"关于系统"按钮 =====
// 在 Admin 页面加一个"关于系统"按钮
let admin3 = fs.readFileSync(adminFile2, 'utf8');
if (!admin3.includes('关于系统') && !admin3.includes('onClick.*setShowAbout')) {
  // 在 Admin 页面 state 里加 showAbout
  if (admin3.includes('const [activeTab') && !admin3.includes('const [showAbout')) {
    admin3 = admin3.replace(
      'const [activeTab',
      'const [showAbout, setShowAbout] = useState(false)\r\n  const [activeTab'
    );
  }
  // 在 footer 区域加关于按钮
  const footerPattern = /(footer.*?"copyright.*?游游记账.*?)<\/div>/s;
  if (footerPattern.test(admin3)) {
    admin3 = admin3.replace(footerPattern, '$1<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"16px",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setShowAbout(true)}>关于系统</p></div>');
  }
  fs.writeFileSync(adminFile2, admin3, 'utf8');
  console.log('Fix 5 applied: About button in Admin');
}

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('All App.tsx fixes saved.');
console.log('Build test...');
