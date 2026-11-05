const fs = require('fs');
let a = fs.readFileSync('D:/1kaifa/money-tracker/src/pages/Admin.tsx', 'utf8');

// ===== 把 AboutSection 从 export 后移到文件开头（imports 之后）=====
// 找到 AboutSection 定义
const aboutStart = a.indexOf('\nfunction AboutSection');
const aboutEnd = a.indexOf('\nexport default Admin');
const aboutSection = a.substring(aboutStart, aboutEnd);
const afterAbout = a.substring(aboutEnd);

// 从原位置删除 AboutSection
let clean = a.substring(0, aboutStart) + afterAbout;

// 找到 AboutSection 引用位置（在 </style> 后）
const refIdx = clean.indexOf('{showAbout && <AboutSection');
// 找到 refIdx 后面最近的 </div>) }
const afterRef = clean.substring(refIdx);
// 找到 </style> 后面的 </div>) } 结构
const styleEnd = clean.indexOf('</style>');
const afterStyle = clean.substring(styleEnd + 8);
const beforeStyle = clean.substring(0, styleEnd + 8);

// 在 </style> 后删除 AboutSection 引用（它会被移到 JSX 内正确位置）
// 把 {showAbout && <AboutSection.../>} 从 </style> 后面删掉
let afterRef2 = afterStyle;
const refEnd = afterRef2.indexOf('/>}') + 3;
afterRef2 = afterRef2.substring(refEnd + 1); // skip past the />}
clean = beforeStyle + afterRef2;
console.log('Removed AboutSection from after JSX, len now:', clean.length);

// 在 JSX 末尾（最后一个 </div> 前）重新插入弹窗
const lastDiv = clean.lastIndexOf('</div>');
if (lastDiv < 0) { console.log('ERROR: last </div> not found'); process.exit(1) }
clean = clean.substring(0, lastDiv) + '{showAbout && <AboutSection onClose={()=>setShowAbout(false)} />}\r\n' + clean.substring(lastDiv);
console.log('Inserted AboutSection before last </div>');

// 去掉版本号 v2.0.1，改成 v3.0.3
clean = clean.replace("游游记账 v2.0.1", "游游记账 v3.0.3");

// 去掉重复的版本号/关于系统（如果有）
// 移除之前 fix6.cjs 加在 export 前的 p 标签
clean = clean.replace(
  '<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"20px"}}>游游记账 v3.0.3 · 游游工作室</p>\r\nexport default Admin',
  'export default Admin'
);
clean = clean.replace(
  '<p style={{textAlign:"center",color:"#9ca3af",fontSize:"12px",marginTop:"12px",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setShowAbout(true)}>关于系统</p>\r\nexport default Admin',
  'export default Admin'
);

// 把 AboutSection 插入到文件开头（imports 之后）
const importEnd = clean.indexOf('\nimport { useEffect');
if (importEnd < 0) { console.log('ERROR: import end not found'); process.exit(1) }
// 找到 useEffect import 的那一行的结尾
const useEffectLineEnd = clean.indexOf('\n', importEnd);
const aboutCode = aboutSection + '\n';
clean = clean.substring(0, useEffectLineEnd) + '\n' + aboutCode + clean.substring(useEffectLineEnd + 1);

fs.writeFileSync('D:/1kaifa/money-tracker/src/pages/Admin.tsx', clean, 'utf8');
console.log('Admin.tsx rewritten');
console.log('AboutSection at start:', clean.includes('function AboutSection'));
console.log('showAbout state:', clean.includes('const [showAbout'));
console.log('v3.0.3:', clean.includes('v3.0.3'));
