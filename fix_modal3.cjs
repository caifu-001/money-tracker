const fs = require('fs');
const c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// Replace the entire agreement modal section
const oldModal = `      {/* 协议弹窗（注册强制查看） */}
      {showAgreementModal && (
        <div style={{
          position:'fixed',top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',
          zIndex:200,backdropFilter:'blur(4px)'
        }}
          onClick={() => setShowAgreementModal(false)}>
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
            {/* 内容（可滚动） */}
            <div
              style={{ flex:1,overflowY:'auto' }}
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
                    我已阅读并同意以上协议
                  </button>
              }
            </div>
          </div>
        </div>
      )}`;

const newModal = `      {/* 协议弹窗 */}
      {showAgreementModal && (
        <div style={{
          position:'fixed',top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',
          zIndex:200
        }}
          onClick={() => setShowAgreementModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'white',borderRadius:'16px',width:'90%',maxWidth:'400px',
            maxHeight:'80vh',display:'flex',flexDirection:'column',
            boxShadow:'0 20px 50px rgba(0,0,0,0.3)'
          }}>
            {/* 标题 */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f0f0f0', display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ fontSize:'15px',fontWeight:700,color:'#333' }}>
                {agreementType === 'agreement' ? '📄 用户协议' : '🔒 隐私政策'}
              </span>
              <button onClick={() => setShowAgreementModal(false)}
                style={{ background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:'#999',padding:'0 4px' }}>
                ✕
              </button>
            </div>
            {/* 内容（弹窗自己监听滚动） */}
            <div
              ref={modalScrollRef}
              onScroll={() => {
                const el = modalScrollRef.current
                if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
                  setAgreementScrolled(true)
                }
              }}
              style={{ flex:1,overflowY:'auto',padding:'20px',fontSize:'13px',color:'#4b5563',lineHeight:'1.8' }}
            >
              {agreementType === 'agreement'
                ? <Agreement embedded={true} />
                : <Privacy embedded={true} />
              }
            </div>
            {/* 底部 */}
            <div style={{ padding:'14px 20px 18px', borderTop:'1px solid #f0f0f0' }}>
              {!agreementScrolled
                ? <div style={{ width:'100%',padding:'12px',background:'#f5f5f5',borderRadius:'10px',textAlign:'center',color:'#aaa',fontSize:'13px' }}>
                  ↕ 请滚动到最底部后确认
                </div>
                : <button
                    onClick={() => { setShowAgreementModal(false); setAgreedAgreement(true) }}
                    style={{
                      width:'100%',padding:'12px',border:'none',borderRadius:'10px',
                      background:'#6366f1',color:'white',fontSize:'14px',fontWeight:600,cursor:'pointer'
                    }}>
                    我已阅读并同意
                  </button>
              }
            </div>
          </div>
        </div>
      )}`;

if (c.includes(oldModal)) {
  console.log('Found old modal, replacing...');
  const newContent = c.replace(oldModal, newModal);
  fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', newContent, 'utf8');
  console.log('SUCCESS');
} else {
  console.log('ERROR: old modal not found');
  // Debug: find the comment marker
  const idx = c.indexOf('{/* 协议弹窗');
  if (idx > -1) {
    console.log('Found comment at:', idx);
    console.log('Context:', JSON.stringify(c.substring(idx, idx + 50)));
  } else {
    console.log('Comment marker not found at all');
  }
}
