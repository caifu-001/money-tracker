const fs = require('fs');
let c = fs.readFileSync('D:/1kaifa/money-tracker/src/App.tsx', 'utf8');
let changes = 0;

// FIX 1: button onClick - 用字节位置精确替换
// 找到目标字符串的字节位置
const marker = '// 首次点击：弹出协议窗口，引导阅读';
const idx = c.indexOf(marker);
if (idx < 0) { console.log('marker not found'); process.exit(1) }

// onClick={() => { 在 marker 前面的位置
const onclick_start = c.lastIndexOf('onClick={() => {', idx);
console.log('onClick start at:', onclick_start, '->', JSON.stringify(c.substring(onclick_start, onclick_start + 30)));

// 找到 onClick 块的结束（下一个 }} 的 style 前）
const style_marker = `                      }}
                      style={{`;
const style_idx = c.indexOf(style_marker, onclick_start);
if (style_idx < 0) { console.log('style marker not found'); process.exit(1) }
const end_idx = style_idx + style_marker.length;
console.log('Block end at:', end_idx, '->', JSON.stringify(c.substring(end_idx - 20, end_idx + 10)));

// 原始块
const old_block = c.substring(onclick_start, end_idx);
console.log('Old block:', JSON.stringify(old_block));

// 新块 - 加 e.stopPropagation
const new_block = old_block
  .replace('onClick={() => {', 'onClick={(e) => {')
  .replace(
    `if (!agreedAgreement) {\r\n                          // 首次点击：弹出协议窗口，引导阅读\r\n`,
    `if (!agreedAgreement) {\r\n                          e.stopPropagation()\r\n`
  );

if (old_block === new_block) {
  console.log('Block unchanged - replacement failed');
  process.exit(1);
}

c = c.substring(0, onclick_start) + new_block + c.substring(end_idx);
changes++;
console.log('FIX 1: stopPropagation applied');

// FIX 2: outer div 加 onClick
// 找 div 的 style 结束位置
const div_marker = `                  <div style={{`;
const div_idx = c.indexOf(div_marker);
if (div_idx < 0) { console.log('div marker not found'); process.exit(1) }
// 找到 div style 的结束（下一个换行后的 >）
const div_style_end = c.indexOf(`                  }}>`, div_idx);
if (div_style_end < 0) { console.log('div style end not found'); process.exit(1) }
// 在 }}> 前插入 onClick
const new_div_end = div_style_end + 4; // after "}}">"
const insert_point = new_div_end;
const new_onclick = `\r\n                    onClick={() => {\r\n                      if (!agreedAgreement) {\r\n                        setAgreementType('agreement')\r\n                        setAgreementScrolled(false)\r\n                        setShowAgreementModal(true)\r\n                      }\r\n                    }}`;
c = c.substring(0, insert_point) + new_onclick + c.substring(insert_point);
changes++;
console.log('FIX 2: div onClick applied');

// FIX 3: throw -> alert
if (c.includes(`if (!agreedAgreement) throw new Error('请先阅读并同意用户协议和隐私政策')`)) {
  c = c.replace(
    `if (!agreedAgreement) throw new Error('请先阅读并同意用户协议和隐私政策')`,
    `if (!agreedAgreement) { alert('请先勾选"我已阅读并同意用户协议和隐私政策"'); return }`
  );
  changes++;
  console.log('FIX 3: throw->alert applied');
} else {
  console.log('FIX 3: throw already fixed');
}

// FIX 4: 登录页底部版本号
const brand_idx = c.indexOf(`{/* 底部品牌 */}`);
if (brand_idx >= 0) {
  c = c.substring(0, brand_idx)
    + `{/* 版本号 */}\r\n          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.45)', fontSize:'12px', marginTop:'4px' }}>游游记账 v3.0.3 · 游游工作室</p>\r\n          {/* 底部品牌 */}`
    + c.substring(brand_idx + `{/* 底部品牌 */}`.length);
  changes++;
  console.log('FIX 4: version applied');
} else {
  console.log('FIX 4: brand not found');
}

fs.writeFileSync('D:/1kaifa/money-tracker/src/App.tsx', c, 'utf8');
console.log('Saved, changes:', changes);
