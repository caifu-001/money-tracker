const fs = require('fs');
let a = fs.readFileSync('D:/1kaifa/money-tracker/src/pages/Admin.tsx', 'utf8');

// The file ends with:
//     </div>
//   )
// }
// (no export default!)
// Find the last } that closes the Admin function - it's the last character
const lastBrace = a.lastIndexOf('}');
console.log('Last brace at:', lastBrace, 'len:', a.length);
// The content before last } should be the closing of Admin function
// Find the last '  )' + '}' that closes the component
// Actually, let's find "})" near the end
const lastClose = a.lastIndexOf('})');
console.log('Last }) at:', lastClose);
console.log('Content after last }):', JSON.stringify(a.substring(lastBrace)));

// The last part of the file should be:
// </div>
//   )
// }
// 
// We need to insert before the last </div>'s closing >

// Find the last </div> 
const lastDiv = a.lastIndexOf('</div>');
console.log('Last </div> at:', lastDiv);

// So we need to:
// 1. Add showAbout state (after useEffect import line)
// 2. Add AboutSection component (before the last }) - right before the closing }
// 3. Insert {showAbout && <AboutSection... />} before the last </div>
// 4. Change v2.0.1 to v3.0.3
// 5. Add export default Admin at the end

// Find the Admin function end: "}\n" at end of file (the last })
const adminEnd = a.length - 1; // last char is }
console.log('Admin ends at:', adminEnd);

// AboutSection to insert before closing }
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
          {tab==='about' && <div><div style={{textAlign:'center',marginBottom:'20px'}}><div style={{fontSize:'40px',marginBottom:'8px'}}>💰</div><h2 style={{fontSize:'18px',fontWeight:800,color:'#1f2937',margin:'0 0 4px'}}>游游记账</h2><p style={{color:'#6366f1',fontSize:'14px',fontWeight:600}}>Version 3.0.3</p></div><p style={{marginBottom:'10px'}}>游游记账是一款简洁高效的<strong>家庭协同记账应用</strong>，支持多账本管理、分类统计、预算控制和数据导入导出。</p><p style={{marginBottom:'10px'}}>支持网页版和小程序双端使用，数据实时同步，随时随地管理家庭财务。</p><p>由 <strong>游游工作室</strong> 开发维护 · 2026</p></div>}
          {tab==='agreement' && <div><h3 style={{fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px'}}>用户协议</h3><p style={{marginBottom:'8px'}}>1. 使用本应用即表示您同意以下条款。</p><p style={{marginBottom:'8px'}}>2. 请勿使用本应用从事违法活动。</p><p style={{marginBottom:'8px'}}>3. 注册后需管理员审核通过方可使用完整功能。</p><p style={{marginBottom:'8px'}}>4. 用户数据归用户本人所有，平台不会用于商业目的。</p><p>5. 如有疑问请联系管理员。</p></div>}
          {tab==='privacy' && <div><h3 style={{fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px'}}>隐私政策</h3><p style={{marginBottom:'8px'}}>1. 我们收集您注册时提供的邮箱、昵称信息。</p><p style={{marginBottom:'8px'}}>2. 记账数据仅用于生成报表和统计分析。</p><p style={{marginBottom:'8px'}}>3. 账户注销后15个工作日内删除全部个人数据。</p><p style={{marginBottom:'8px'}}>4. 您的数据存储在中华人民共和国境内服务器。</p><p>5. 如有隐私问题请联系管理员。</p></div>}
        </div>
        <div style={{padding:'14px 20px 18px',textAlign:'center',borderTop:'1px solid #f3f4f6'}}><p style={{color:'#9ca3af',fontSize:'12px',margin:'0'}}>游游记账 v3.0.3 · 游游工作室</p></div>
      </div>
    </div>
  )
}
`;

// Step 1: Add showAbout state
if (!a.includes('const [showAbout')) {
  const marker = "import { useEffect, useState, useRef } from 'react'";
  const idx = a.indexOf(marker);
  if (idx < 0) { console.log('ERROR: import marker not found'); process.exit(1); }
  const endOfLine = a.indexOf('\r\n', idx);
  a = a.substring(0, endOfLine) + '\r\n  const [showAbout, setShowAbout] = useState(false)' + a.substring(endOfLine);
  console.log('1: showAbout added');
}

// Step 2: Add AboutSection before the last }
a = a.substring(0, adminEnd) + aboutSection + '\r\n' + a.substring(adminEnd);
console.log('2: AboutSection added');

// Step 3: Insert popup at end of JSX (before the last </div>)
const lastDiv = a.lastIndexOf('</div>');
a = a.substring(0, lastDiv) + '{showAbout && <AboutSection onClose={()=>setShowAbout(false)} />}\r\n' + a.substring(lastDiv);
console.log('3: popup inserted');

// Step 4: Version
a = a.replace('游游记账 v2.0.1', '游游记账 v3.0.3');
console.log('4: version updated');

// Step 5: Add export default Admin
a = a + '\r\nexport default Admin\r\n';
console.log('5: export added');

fs.writeFileSync('D:/1kaifa/money-tracker/src/pages/Admin.tsx', a, 'utf8');
console.log('Done! length:', a.length);
