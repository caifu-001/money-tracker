const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');

// Step 1: Add modalScrollRef after agreementScrolled state
const stateLine = "const [agreementScrolled, setAgreementScrolled] = useState(false)";
const stateIdx = c.indexOf(stateLine);
if (stateIdx === -1) { console.log('ERROR: state not found'); process.exit(1) }

// Check if useRef is imported
if (!c.includes('useRef')) {
  // Add useRef to imports
  c = c.replace("import { useEffect, useState } from 'react'", "import { useEffect, useRef, useState } from 'react'");
  console.log('Added useRef to imports');
}

// Add ref declaration
c = c.replace(
  stateLine,
  stateLine + "\r\n  const modalScrollRef = useRef<HTMLDivElement>(null)"
);

// Step 2: Find and replace the modal section
// Find the start marker
const startMarker = '{/* 协议弹窗';
const startIdx = c.indexOf(startMarker);
if (startIdx === -1) { console.log('ERROR: modal start not found'); process.exit(1) }

// Find the end - look for the closing of this block
// The modal is followed by )} then newline then </div>
// Find the last `)}` before the final `</div>`
const afterModal = c.substring(startIdx);
// Count braces to find the end of the JSX expression
let depth = 0;
let endPos = 0;
for (let i = 0; i < afterModal.length; i++) {
  if (afterModal[i] === '{') depth++;
  if (afterModal[i] === '}') { depth--; if (depth === 0) { endPos = i + 1; break; } }
}

// The modal ends at startIdx + endPos, and there should be a newline after
const modalBlock = c.substring(startIdx, startIdx + endPos);
console.log('Modal block length:', modalBlock.length);
console.log('Modal starts with:', JSON.stringify(modalBlock.substring(0, 60)));

// Build new modal
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
                {agreementType === 'agreement' ? '\uD83D\uDCC4 用户协议' : '\uD83D\uDD12 隐私政策'}
              </span>
              <button onClick={() => setShowAgreementModal(false)}
                style={{ background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:'#999',padding:'0 4px' }}>
                \u2715
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
                    \u2195 \u8BF7\u6EDA\u52A8\u5230\u6700\u5E95\u90E8\u540E\u786E\u8BA4
                  </div>
                : <button
                    onClick={() => { setShowAgreementModal(false); setAgreedAgreement(true) }}
                    style={{
                      width:'100%',padding:'12px',border:'none',borderRadius:'10px',
                      background:'#6366f1',color:'white',fontSize:'14px',fontWeight:600,cursor:'pointer'
                    }}>
                    \u6211\u5DF2\u9605\u8BFB\u5E76\u540C\u610F
                  </button>
              }
            </div>
          </div>
        </div>
      )}`;

c = c.substring(0, startIdx) + newModal + c.substring(startIdx + endPos);

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('SUCCESS');

// Verify
const v = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
console.log('Has modalScrollRef:', v.includes('modalScrollRef'));
console.log('Has useRef:', v.includes('useRef'));
console.log('Has stopPropagation:', v.includes('e.stopPropagation'));
console.log('No old modal:', !v.includes('onScrollToBottom={() => setAgreementScrolled(true)}'));
console.log('Embedded without scroll prop:', v.includes('<Agreement embedded={true} />'));
