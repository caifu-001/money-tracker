const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/App.tsx');
let content = fs.readFileSync(file, 'utf8');

// Find and replace the modal section
const oldSection = `          zIndex:200,backdropFilter:'blur(4px)'
        }}>
          <div style={{
            background:'white',borderRadius:'20px',width:'90%',maxWidth:'420px',
            maxHeight:'80vh',display:'flex',flexDirection:'column',
            boxShadow:'0 24px 60px rgba(0,0,0,0.25)',overflow:'hidden'
          }}>
            {/* 标题栏 */}
            <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #f3f4f6', display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
                <span style={{ fontSize:'20px' }}>{agreementType === 'agreement' ? '📄' : '🔒'}</span>
                <span style={{ fontSize:'16px',fontWeight:700,color:'#1f2937' }}>
                  {agreementType === 'agreement' ? '用户协议' : '隐私政策'}
                </span>
              </div>
              <button onClick={() => setShowAgreementModal(false)}
                style={{ background:'none',border:'none',cursor:'pointer',fontSize:'20px',color:'#9ca3af',padding:'4px' }}>
                ✕
              </button>
            </div>
            {/* 内容（可滚动） */}
            <div
              onScroll={e => { if ((e.target as HTMLDivElement).scrollHeight - (e.target as HTMLDivElement).scrollTop <= (e.target as HTMLDivElement).clientHeight + 20) setAgreementScrolled(true) }}
              onClick={() => setAgreementScrolled(true)}
              style={{ flex:1,overflowY:'auto',padding:'16px 20px',fontSize:'13px',color:'#4b5563',lineHeight:'1.8',cursor: agreementScrolled ? 'default' : 'default' }}
            >
              {agreementType === 'agreement'
                ? <Agreement onScrollToBottom={() => setAgreementScrolled(true)} embedded={true} />
                : <Privacy onScrollToBottom={() => setAgreementScrolled(true)} embedded={true} />
              }
            </div>
            {/* 底部确认栏 */}
            <div style={{ padding:'16px 20px 24px', borderTop:'1px solid #f3f4f6', display:'flex',alignItems:'center',justifyContent:'center' }}>
              {!agreementScrolled
                ? <div style={{ width:'100%',padding:'14px',background:'#f3f4f6',borderRadius:'12px',textAlign:'center',color:'#9ca3af',fontSize:'14px' }}>
                  📜 请向上滚动完整阅读后再确认
                </div>
                : <button
                    onClick={() => { setShowAgreementModal(false); setAgreedAgreement(true) }}
                    style={{
                      width:'100%',padding:'14px',border:'none',borderRadius:'12px',
                      background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      color:'white',fontSize:'15px',fontWeight:700,cursor:'pointer',
                      boxShadow:'0 4px 15px rgba(99,102,241,0.4)'
                    }}
                  >
                    已阅读并同意
                  </button>
              }
            </div>
          </div>
        </div>`;

const newSection = `          zIndex:200,backdropFilter:'blur(4px)'
        }}
          onClick={() => setShowAgreementModal(false)}>
          {/* 弹窗主体（阻止冒泡，点击卡片不关闭） */}
          <div onClick={e => e.stopPropagation()} style={{
            background:'white',borderRadius:'20px',width:'90%',maxWidth:'420px',
            maxHeight:'80vh',display:'flex',flexDirection:'column',
            boxShadow:'0 24px 60px rgba(0,0,0,0.25)',overflow:'hidden'
          }}>
            {/* 标题栏 */}
            <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #f3f4f6', display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
                <span style={{ fontSize:'20px' }}>{agreementType === 'agreement' ? '📄' : '🔒'}</span>
                <span style={{ fontSize:'16px',fontWeight:700,color:'#1f2937' }}>
                  {agreementType === 'agreement' ? '用户协议' : '隐私政策'}
                </span>
              </div>
              <button onClick={() => setShowAgreementModal(false)}
                style={{ background:'none',border:'none',cursor:'pointer',fontSize:'20px',color:'#9ca3af',padding:'4px' }}>
                ✕
              </button>
            </div>
            {/* 内容（Agreement组件内部监听滚动） */}
            <div style={{ flex:1,overflowY:'auto' }}>
              {agreementType === 'agreement'
                ? <Agreement onScrollToBottom={() => setAgreementScrolled(true)} embedded={true} />
                : <Privacy onScrollToBottom={() => setAgreementScrolled(true)} embedded={true} />
              }
            </div>
            {/* 底部确认栏 */}
            <div style={{ padding:'16px 20px 24px', borderTop:'1px solid #f3f4f6', display:'flex',alignItems:'center',justifyContent:'center' }}>
              {!agreementScrolled
                ? <div style={{ width:'100%',padding:'14px',background:'#f3f4f6',borderRadius:'12px',textAlign:'center',color:'#9ca3af',fontSize:'14px' }}>
                    📜 请向上滚动完整阅读后再确认
                  </div>
                : <button
                    onClick={() => { setShowAgreementModal(false); setAgreedAgreement(true) }}
                    style={{
                      width:'100%',padding:'14px',border:'none',borderRadius:'12px',
                      background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      color:'white',fontSize:'15px',fontWeight:700,cursor:'pointer',
                      boxShadow:'0 4px 15px rgba(99,102,241,0.4)'
                    }}>
                    我已阅读并同意以上协议
                  </button>
              }
            </div>
          </div>
        </div>`;

if (content.includes(oldSection)) {
  content = content.replace(oldSection, newSection);
  fs.writeFileSync(file, content, 'utf8');
  console.log('SUCCESS: Modal section replaced');
} else {
  console.log('ERROR: oldSection not found in file');
  // Try to find partial match
  if (content.includes('onClick={() => setAgreementScrolled(true)}')) {
    console.log('Found partial: onClick in modal area');
  }
  if (content.includes('e.stopPropagation')) {
    console.log('Found partial: e.stopPropagation');
  }
}
