const fs = require('fs');
const c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// Step 1: Add modalScrollRef after agreementScrolled state
const stateLine = "const [agreementScrolled, setAgreementScrolled] = useState(false)";
if (c.includes(stateLine)) {
  const idx = c.indexOf(stateLine) + stateLine.length;
  const before = c.substring(0, idx);
  const after = c.substring(idx);
  c2 = before + "\r\n  const modalScrollRef = useRef<HTMLDivElement>(null)" + after;
} else {
  console.log('ERROR: state line not found');
  process.exit(1);
}

// Step 2: Replace the agreement modal
const marker = '{/* 协议弹窗（注册强制查看） */}';
const endMarker = '      )}\r\n    </div>\r\n  )\r\n}\r\n\r\nexport default App';
const markerIdx = c2.indexOf(marker);
const endIdx = c2.indexOf(endMarker);

if (markerIdx === -1) {
  console.log('ERROR: modal marker not found');
  process.exit(1);
}

const newModal = `{/* 协议弹窗 */}
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
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f0f0f0', display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ fontSize:'15px',fontWeight:700,color:'#333' }}>
                {agreementType === 'agreement' ? '\\u{1F4C4} 用户协议' : '\\u{1F512} 隐私政策'}
              </span>
              <button onClick={() => setShowAgreementModal(false)}
                style={{ background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:'#999',padding:'0 4px' }}>
                ✕
              </button>
            </div>
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
            <div style={{ padding:'14px 20px 18px', borderTop:'1px solid #f0f0f0' }}>
              {!agreementScrolled
                ? <div style={{ width:'100%',padding:'12px',background:'#f5f5f5',borderRadius:'10px',textAlign:'center',color:'#aaa',fontSize:'13px' }}>
                    \\u2195 请滚动到最底部后确认
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

const finalContent = c2.substring(0, markerIdx) + newModal + '\r\n    </div>\r\n  )\r\n}\r\n\r\nexport default App';

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', finalContent, 'utf8');
console.log('Done! Checking...');

const c3 = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
console.log('Has modalScrollRef:', c3.includes('modalScrollRef'));
console.log('Has useRef import needed:', !c3.includes("import { useRef }"));
console.log('No old onScrollToBottom in modal:', !c3.includes('onScrollToBottom={() => setAgreementScrolled(true)}'));
console.log('Has embedded without onScrollToBottom:', c3.includes('<Agreement embedded={true} />'));
