import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, ChevronDown, ChevronRight, X, Pencil, Check } from 'lucide-react'
import { useSystemConfig } from '../lib/systemConfig'
import { ImeInput } from '../components/ImeInput'

interface Category {
  id: string; name: string; icon: string
  type: 'income'|'expense'; parent_id: string|null; level: number; children?: Category[]
}

// 常用 emoji 图标库（分组）
const EMOJI_GROUPS = [
  { label: '生活', emojis: ['🍔','🍜','🍕','🥗','🍱','☕','🛒','🏠','🛋️','🧹','💡','🚿','🔑','🛏️'] },
  { label: '交通', emojis: ['🚗','🚌','🚇','✈️','🚲','🛵','🚕','🚂','⛽','🅿️'] },
  { label: '娱乐', emojis: ['🎮','🎬','🎵','🎨','📚','🎯','🏋️','⚽','🎭','🎪','🎲','🎸'] },
  { label: '购物', emojis: ['🛍️','👗','👟','💄','💍','⌚','📱','💻','📷','🎁'] },
  { label: '医疗', emojis: ['⚕️','💊','🏥','🩺','🩹','🧬','💉','🦷','👓','🩻'] },
  { label: '金融', emojis: ['💰','💵','💳','📈','📉','🏦','💹','🪙','💎','🏧'] },
  { label: '工作', emojis: ['💼','📊','📋','🖥️','✏️','📝','🗂️','📌','🔧','⚙️'] },
  { label: '其他', emojis: ['🌟','❤️','🎀','🌈','🌸','🍀','🔔','🎯','📌','🏷️','🗑️','🔖'] },
]

function findLevel(cats: Category[], id: string): number {
  for (const c of cats) {
    if (c.id === id) return c.level
    if (c.children) { const f = findLevel(c.children, id); if (f > 0) return f }
  }
  return 0
}

// 图标选择器弹窗
function EmojiPicker({ value, onChange, onClose }: { value: string; onChange: (e: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div ref={ref} style={{ position:'absolute', zIndex:100, top:'100%', left:0, background:'white', borderRadius:'16px', boxShadow:'0 8px 32px rgba(0,0,0,0.15)', padding:'12px', width:'280px', marginTop:'4px' }}>
      {/* 分组标签 */}
      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'10px' }}>
        {EMOJI_GROUPS.map((g, i) => (
          <button key={i} onClick={() => setTab(i)} style={{ padding:'3px 8px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:600, background: tab===i ? '#6366f1' : '#f3f4f6', color: tab===i ? 'white' : '#6b7280' }}>{g.label}</button>
        ))}
      </div>
      {/* emoji 网格 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
        {EMOJI_GROUPS[tab].emojis.map(e => (
          <button key={e} onClick={() => { onChange(e); onClose() }} style={{ padding:'6px', borderRadius:'8px', border: value===e ? '2px solid #6366f1' : '2px solid transparent', background: value===e ? '#eef2ff' : 'transparent', cursor:'pointer', fontSize:'20px', lineHeight:1 }}>{e}</button>
        ))}
      </div>
      {/* 自定义输入 */}
      <div style={{ marginTop:'10px', borderTop:'1px solid #f3f4f6', paddingTop:'10px' }}>
        <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'6px' }}>或直接输入 emoji：</p>
        <input defaultValue={value} onChange={e => onChange(e.target.value)}
          style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'16px', outline:'none', boxSizing:'border-box' }}/>
      </div>
    </div>
  )
}

export function Categories() {
  const { currentLedger } = useAppStore()
  const sysConfig = useSystemConfig()   // ← 读取系统配置（含管理员修改后的默认类别）
  const [expenseCats, setExpenseCats] = useState<Category[]>([])
  const [incomeCats, setIncomeCats] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 顶级新增表单
  const [showTopForm, setShowTopForm] = useState(false)
  const [topFormType, setTopFormType] = useState<'income'|'expense'>('expense')
  const [topFormName, setTopFormName] = useState('')
  const [topFormIcon, setTopFormIcon] = useState('📌')
  const [showTopEmojiPicker, setShowTopEmojiPicker] = useState(false)

  // 子类别内联表单
  const [inlineFormId, setInlineFormId] = useState<string|null>(null)
  const [inlineName, setInlineName] = useState('')
  const [inlineIcon, setInlineIcon] = useState('📌')
  const [showInlineEmojiPicker, setShowInlineEmojiPicker] = useState(false)

  // 编辑状态：editId = 正在编辑的类别 id
  const [editId, setEditId] = useState<string|null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false)

  // 预置类别编辑（存在 DB 中，key = 类别名称）
  const [presetEditKey, setPresetEditKey] = useState<string|null>(null)
  const [presetEditName, setPresetEditName] = useState('')
  const [presetEditIcon, setPresetEditIcon] = useState('')
  const [showPresetEmojiPicker, setShowPresetEmojiPicker] = useState(false)
  // 预置类别子类别表单
  const [presetChildKey, setPresetChildKey] = useState<string|null>(null)
  const [presetChildName, setPresetChildName] = useState('')
  const [presetChildIcon, setPresetChildIcon] = useState('📌')
  const [showPresetChildEmojiPicker, setShowPresetChildEmojiPicker] = useState(false)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => { if (currentLedger) loadCategories() }, [currentLedger])

  const loadCategories = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('categories').select('*')
      .eq('ledger_id', currentLedger?.id).order('level').order('name')
    if (data) {
      const map = new Map<string, Category>()
      data.forEach((c: any) => map.set(c.id, { ...c, children: [] }))
      const roots: Category[] = []
      data.forEach((c: any) => {
        if (c.parent_id) map.get(c.parent_id)?.children?.push(map.get(c.id)!)
        else roots.push(map.get(c.id)!)
      })
      setExpenseCats(roots.filter(c => c.type === 'expense'))
      setIncomeCats(roots.filter(c => c.type === 'income'))
    }
    setIsLoading(false)
  }

  const handleAddTop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topFormName.trim()) return alert('请输入类别名称')
    const { error } = await supabase.from('categories').insert([{
      ledger_id: currentLedger!.id, name: topFormName, icon: topFormIcon,
      type: topFormType, parent_id: null, level: 1
    }])
    if (error) return alert(error.message)
    setTopFormName(''); setTopFormIcon('📌'); setShowTopForm(false)
    await loadCategories()
  }

  const handleAddChild = async (e: React.FormEvent, parentId: string, parentType: 'income'|'expense') => {
    e.preventDefault()
    if (!inlineName.trim()) return alert('请输入类别名称')
    const allCats = [...expenseCats, ...incomeCats]
    const parentLevel = findLevel(allCats, parentId)
    if (parentLevel >= 5) return alert('最多只能创建5级子类别')
    const { error } = await supabase.from('categories').insert([{
      ledger_id: currentLedger!.id, name: inlineName, icon: inlineIcon,
      type: parentType, parent_id: parentId, level: parentLevel + 1
    }])
    if (error) return alert(error.message)
    setExpanded(prev => new Set([...prev, parentId]))
    setInlineFormId(null); setInlineName(''); setInlineIcon('📌')
    await loadCategories()
  }

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return alert('名称不能为空')
    const { error } = await supabase.from('categories').update({ name: editName, icon: editIcon }).eq('id', id)
    if (error) return alert(error.message)
    setEditId(null)
    await loadCategories()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？子类别也会一并删除')) return
    const del = async (cid: string) => {
      const { data: ch } = await supabase.from('categories').select('id').eq('parent_id', cid)
      if (ch) for (const c of ch) await del(c.id)
      await supabase.from('categories').delete().eq('id', cid)
    }
    await del(id); await loadCategories()
  }

  // 预置类别：添加子类别到 DB
  const handlePresetAddChild = async (e: React.FormEvent, presetName: string, type: 'income'|'expense') => {
    e.preventDefault()
    if (!presetChildName.trim()) return alert('请输入类别名称')
    // 先检查 DB 中是否有对应的预置类别记录，没有则创建
    let { data: existing } = await supabase.from('categories').select('id,level').eq('ledger_id', currentLedger!.id).eq('name', presetName).eq('type', type).is('parent_id', null).single()
    if (!existing) {
      const preset = sysConfig.defaultExpenseCategories.concat(sysConfig.defaultIncomeCategories).find(c => c.name === presetName)
      const { data: newCat } = await supabase.from('categories').insert([{
        ledger_id: currentLedger!.id, name: presetName, icon: preset?.icon || '📌',
        type, parent_id: null, level: 1
      }]).select().single()
      existing = newCat
    }
    if (!existing) return alert('创建父类别失败')
    const { error } = await supabase.from('categories').insert([{
      ledger_id: currentLedger!.id, name: presetChildName, icon: presetChildIcon,
      type, parent_id: existing.id, level: 2
    }])
    if (error) return alert(error.message)
    setPresetChildKey(null); setPresetChildName(''); setPresetChildIcon('📌')
    await loadCategories()
  }

  const toggle = (id: string) => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  // 递归渲染自定义类别树
  const renderTree = (cats: Category[], type: 'income'|'expense', depth = 0): React.ReactNode => cats.map(cat => (
    <div key={cat.id}>
      <div style={{
        display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px',
        marginLeft: depth * 18 + 'px', background: depth===0 ? '#f9fafb' : '#f3f4f6',
        borderRadius:'12px', marginBottom:'4px',
        border: (editId===cat.id || inlineFormId===cat.id) ? '2px solid #6366f1' : '2px solid transparent'
      }}>
        {cat.children && cat.children.length > 0
          ? <button onClick={() => toggle(cat.id)} style={{ background:'none', border:'none', cursor:'pointer', padding:'2px', color:'#9ca3af', display:'flex', flexShrink:0 }}>
              {expanded.has(cat.id) ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
            </button>
          : <div style={{ width:'19px', flexShrink:0 }}/>
        }

        {editId === cat.id ? (
          // 编辑模式
          <>
            <div style={{ position:'relative', flexShrink:0 }}>
              <button type="button" onClick={() => setShowEditEmojiPicker(!showEditEmojiPicker)}
                style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1.5px solid #e5e7eb', background:'white', fontSize:'20px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {editIcon}
              </button>
              {showEditEmojiPicker && <EmojiPicker value={editIcon} onChange={setEditIcon} onClose={() => setShowEditEmojiPicker(false)}/>}
            </div>
            <ImeInput value={editName} onChange={setEditName}
              autoFocus
              style={{ flex:1, padding:'7px 10px', border:'1.5px solid #6366f1', borderRadius:'10px', fontSize:'14px', outline:'none', minWidth:0 }}/>
            <button onClick={() => handleEdit(cat.id)} style={{ background:'#6366f1', border:'none', borderRadius:'8px', padding:'6px', cursor:'pointer', color:'white', display:'flex', flexShrink:0 }}><Check size={14}/></button>
            <button onClick={() => setEditId(null)} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'6px', cursor:'pointer', color:'#6b7280', display:'flex', flexShrink:0 }}><X size={14}/></button>
          </>
        ) : (
          // 显示模式
          <>
            <span style={{ fontSize:'20px', flexShrink:0 }}>{cat.icon}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:'14px', fontWeight:500, color:'#1f2937' }}>{cat.name}</p>
              <p style={{ fontSize:'11px', color:'#9ca3af' }}>第{cat.level}级{cat.children?.length ? ` · ${cat.children.length}个子类别` : ''}</p>
            </div>
            <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
              <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditIcon(cat.icon); setShowEditEmojiPicker(false) }}
                style={{ background:'#eef2ff', border:'none', borderRadius:'8px', padding:'5px', cursor:'pointer', color:'#6366f1', display:'flex' }}>
                <Pencil size={13}/>
              </button>
              {cat.level < 5 && (
                <button onClick={() => { if (inlineFormId===cat.id) setInlineFormId(null); else { setInlineFormId(cat.id); setInlineName(''); setInlineIcon('📌'); setExpanded(prev => new Set([...prev, cat.id])) } }}
                  style={{ background: inlineFormId===cat.id ? '#eef2ff' : '#f0f0f0', border:'none', borderRadius:'8px', padding:'5px 8px', cursor:'pointer', color: inlineFormId===cat.id ? '#6366f1' : '#6b7280', display:'flex', alignItems:'center', gap:'3px', fontSize:'12px', fontWeight:600 }}>
                  <Plus size={13}/> 子类
                </button>
              )}
              <button onClick={() => handleDelete(cat.id)}
                style={{ background:'#fff1f2', border:'none', borderRadius:'8px', padding:'5px', cursor:'pointer', color:'#ef4444', display:'flex' }}>
                <Trash2 size={13}/>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 内联添加子类别表单 */}
      {inlineFormId === cat.id && (
        <form onSubmit={e => handleAddChild(e, cat.id, type)} style={{
          marginLeft: (depth+1)*18+'px', marginBottom:'6px',
          background:'white', borderRadius:'12px', padding:'12px',
          border:'1.5px solid #e0e7ff', boxShadow:'0 2px 8px rgba(99,102,241,0.1)'
        }}>
          <p style={{ fontSize:'12px', color:'#6366f1', fontWeight:600, marginBottom:'8px' }}>➕ 添加「{cat.name}」的子类别</p>
          <div style={{ display:'flex', gap:'8px', marginBottom:'8px', alignItems:'center' }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <button type="button" onClick={() => setShowInlineEmojiPicker(!showInlineEmojiPicker)}
                style={{ width:'40px', height:'40px', borderRadius:'10px', border:'1.5px solid #e5e7eb', background:'#f9fafb', fontSize:'20px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {inlineIcon}
              </button>
              {showInlineEmojiPicker && <EmojiPicker value={inlineIcon} onChange={setInlineIcon} onClose={() => setShowInlineEmojiPicker(false)}/>}
            </div>
            <ImeInput value={inlineName} onChange={setInlineName}
              placeholder="子类别名称（支持中文）"
              autoFocus
              style={{ flex:1, padding:'10px 12px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'14px', outline:'none', minWidth:0 }}
            />
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            <button type="submit" style={{ flex:1, background:'#6366f1', color:'white', border:'none', borderRadius:'10px', padding:'9px', fontWeight:600, cursor:'pointer', fontSize:'13px' }}>确认添加</button>
            <button type="button" onClick={() => setInlineFormId(null)} style={{ padding:'9px 12px', background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center' }}><X size={14}/></button>
          </div>
        </form>
      )}

      {cat.children && cat.children.length > 0 && expanded.has(cat.id) && (
        <div style={{ marginBottom:'4px' }}>{renderTree(cat.children, type, depth+1)}</div>
      )}
    </div>
  ))

  if (!currentLedger) return <div style={{ textAlign:'center', padding:'48px', color:'#9ca3af' }}>请先选择账本</div>

  // 渲染预置类别（支持编辑名称/图标、添加子类别）
  const renderPreset = (preset: any, type: 'income'|'expense') => {
    const key = `${type}:${preset.name}`
    const isEditing = presetEditKey === key
    const isAddingChild = presetChildKey === key
    // 查找 DB 中该预置类别的子类别
    const allCats = type === 'expense' ? expenseCats : incomeCats
    const dbCat = allCats.find(c => c.name === (isEditing ? presetEditName : preset.name) || c.name === preset.name)
    const children = dbCat?.children || []

    return (
      <div key={key} style={{ background:'#f9fafb', borderRadius:'14px', padding:'10px 12px', border: (isEditing||isAddingChild) ? '2px solid #6366f1' : '2px solid transparent', marginBottom:'6px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {isEditing ? (
            <>
              <div style={{ position:'relative', flexShrink:0 }}>
                <button type="button" onClick={() => setShowPresetEmojiPicker(!showPresetEmojiPicker)}
                  style={{ width:'40px', height:'40px', borderRadius:'10px', border:'1.5px solid #e5e7eb', background:'white', fontSize:'22px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {presetEditIcon}
                </button>
                {showPresetEmojiPicker && <EmojiPicker value={presetEditIcon} onChange={setPresetEditIcon} onClose={() => setShowPresetEmojiPicker(false)}/>}
              </div>
              <ImeInput value={presetEditName} onChange={setPresetEditName} autoFocus
                style={{ flex:1, padding:'8px 10px', border:'1.5px solid #6366f1', borderRadius:'10px', fontSize:'14px', outline:'none', minWidth:0 }}/>
              <button onClick={async () => {
                // 更新 DB 中的预置类别（如果存在）
                if (dbCat) await supabase.from('categories').update({ name: presetEditName, icon: presetEditIcon }).eq('id', dbCat.id)
                setPresetEditKey(null); await loadCategories()
              }} style={{ background:'#6366f1', border:'none', borderRadius:'8px', padding:'6px', cursor:'pointer', color:'white', display:'flex', flexShrink:0 }}><Check size={14}/></button>
              <button onClick={() => setPresetEditKey(null)} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'6px', cursor:'pointer', color:'#6b7280', display:'flex', flexShrink:0 }}><X size={14}/></button>
            </>
          ) : (
            <>
              <span style={{ fontSize:'24px', flexShrink:0 }}>{preset.icon}</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'14px', fontWeight:500, color:'#1f2937' }}>{preset.name}</p>
                {children.length > 0 && <p style={{ fontSize:'11px', color:'#9ca3af' }}>{children.length}个子类别</p>}
              </div>
              <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                <button onClick={() => { setPresetEditKey(key); setPresetEditName(preset.name); setPresetEditIcon(preset.icon); setShowPresetEmojiPicker(false) }}
                  style={{ background:'#eef2ff', border:'none', borderRadius:'8px', padding:'5px', cursor:'pointer', color:'#6366f1', display:'flex' }}>
                  <Pencil size={13}/>
                </button>
                <button onClick={() => { if (presetChildKey===key) setPresetChildKey(null); else { setPresetChildKey(key); setPresetChildName(''); setPresetChildIcon('📌') } }}
                  style={{ background: presetChildKey===key ? '#eef2ff' : '#f0f0f0', border:'none', borderRadius:'8px', padding:'5px 8px', cursor:'pointer', color: presetChildKey===key ? '#6366f1' : '#6b7280', display:'flex', alignItems:'center', gap:'3px', fontSize:'12px', fontWeight:600 }}>
                  <Plus size={13}/> 子类
                </button>
              </div>
            </>
          )}
        </div>

        {/* 预置类别的子类别列表 */}
        {children.length > 0 && (
          <div style={{ marginTop:'8px', paddingLeft:'16px', display:'flex', flexDirection:'column', gap:'4px' }}>
            {children.map((child: Category) => (
              <div key={child.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:'#f3f4f6', borderRadius:'10px' }}>
                <span style={{ fontSize:'16px' }}>{child.icon}</span>
                <span style={{ flex:1, fontSize:'13px', color:'#374151' }}>{child.name}</span>
                <button onClick={() => handleDelete(child.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#d1d5db', display:'flex', padding:'2px' }}><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
        )}

        {/* 预置类别添加子类别表单 */}
        {presetChildKey === key && (
          <form onSubmit={e => handlePresetAddChild(e, preset.name, type)} style={{ marginTop:'8px', paddingLeft:'16px' }}>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <button type="button" onClick={() => setShowPresetChildEmojiPicker(!showPresetChildEmojiPicker)}
                  style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1.5px solid #e5e7eb', background:'white', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {presetChildIcon}
                </button>
                {showPresetChildEmojiPicker && <EmojiPicker value={presetChildIcon} onChange={setPresetChildIcon} onClose={() => setShowPresetChildEmojiPicker(false)}/>}
              </div>
              <ImeInput value={presetChildName} onChange={setPresetChildName}
                placeholder="子类别名称"
                autoFocus
                style={{ flex:1, padding:'8px 10px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'13px', outline:'none', minWidth:0 }}
              />
              <button type="submit" style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'8px 10px', cursor:'pointer', fontSize:'12px', fontWeight:600, flexShrink:0 }}>添加</button>
              <button type="button" onClick={() => setPresetChildKey(null)} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'8px', cursor:'pointer', color:'#6b7280', display:'flex', flexShrink:0 }}><X size={13}/></button>
            </div>
          </form>
        )}
      </div>
    )
  }

  const Section = ({ title, color, presets, custom, type }: { title:string, color:string, presets:any[], custom:Category[], type:'income'|'expense' }) => (
    <div>
      <h2 style={{ fontSize:'15px', fontWeight:700, color, marginBottom:'12px' }}>{title}</h2>
      <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'8px' }}>预置类别 <span style={{ color:'#c7d2fe' }}>（点击 ✏️ 修改，点击 + 子类 添加子类别）</span></p>
      <div style={{ marginBottom:'16px' }}>
        {presets.map(c => renderPreset(c, type))}
      </div>
      <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'8px' }}>自定义类别</p>
      {custom.length > 0
        ? renderTree(custom, type)
        : <p style={{ fontSize:'13px', color:'#d1d5db', textAlign:'center', padding:'12px 0' }}>暂无自定义类别</p>
      }
    </div>
  )

  return (
    <div style={{ padding:'16px', paddingBottom:'80px', display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* 标题 + 新增按钮 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1 style={{ fontSize:'18px', fontWeight:700, color:'#1f2937' }}>📂 类别管理</h1>
        <button onClick={() => setShowTopForm(!showTopForm)} style={{
          display:'flex', alignItems:'center', gap:'4px',
          background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white',
          border:'none', borderRadius:'12px', padding:'8px 14px',
          fontSize:'13px', fontWeight:600, cursor:'pointer'
        }}><Plus size={16}/> 新增类别</button>
      </div>

      {/* 顶级新增表单 */}
      {showTopForm && (
        <form onSubmit={handleAddTop} style={{ background:'white', borderRadius:'16px', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize:'13px', fontWeight:600, color:'#374151', marginBottom:'12px' }}>新增顶级类别</p>
          <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
            {(['expense','income'] as const).map(t=>(
              <button key={t} type="button" onClick={()=>setTopFormType(t)} style={{
                flex:1, padding:'8px', borderRadius:'10px', border:'1.5px solid',
                borderColor: topFormType===t ? (t==='expense'?'#ef4444':'#22c55e') : '#e5e7eb',
                background: topFormType===t ? (t==='expense'?'#fff1f2':'#f0fdf4') : 'white',
                color: topFormType===t ? (t==='expense'?'#ef4444':'#16a34a') : '#9ca3af',
                fontSize:'13px', fontWeight:600, cursor:'pointer'
              }}>{t==='expense'?'💸 支出':'💰 收入'}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'10px', alignItems:'center' }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <button type="button" onClick={() => setShowTopEmojiPicker(!showTopEmojiPicker)}
                style={{ width:'48px', height:'48px', borderRadius:'12px', border:'1.5px solid #e5e7eb', background:'#f9fafb', fontSize:'24px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {topFormIcon}
              </button>
              {showTopEmojiPicker && <EmojiPicker value={topFormIcon} onChange={setTopFormIcon} onClose={() => setShowTopEmojiPicker(false)}/>}
            </div>
            <ImeInput value={topFormName} onChange={setTopFormName} placeholder="类别名称（支持中文）"
              style={{ flex:1, padding:'12px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'14px', outline:'none', minWidth:0 }}/>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button type="submit" style={{ flex:1, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white', border:'none', borderRadius:'10px', padding:'11px', fontWeight:600, cursor:'pointer' }}>添加</button>
            <button type="button" onClick={()=>setShowTopForm(false)} style={{ flex:1, background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'10px', padding:'11px', fontWeight:600, cursor:'pointer' }}>取消</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>加载中...</div>
      ) : <>
        <Section title="支出类别" color="#ef4444" presets={sysConfig.defaultExpenseCategories} custom={expenseCats} type="expense"/>
        <div style={{ height:'1px', background:'#f3f4f6' }}/>
        <Section title="收入类别" color="#16a34a" presets={sysConfig.defaultIncomeCategories} custom={incomeCats} type="income"/>
      </>}
    </div>
  )
}
