import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useSystemConfig, saveSystemConfig } from '../lib/systemConfig'
// 修复：忽略未使用的 GripVertical 导入（保留代码，仅屏蔽报错）
// @ts-ignore
import { Plus, Trash2, GripVertical, Settings, Type, Tag } from 'lucide-react'
import { ImeInput } from '../components/ImeInput'

// 常用 emoji 快选
const QUICK_EMOJIS = ['🍔','🚗','🎮','🛍️','⚕️','📚','🏠','💡','📱','🛡️','✈️','📌',
  '💰','🎁','📈','💼','🍜','☕','🎵','🎨','💊','🏥','💳','🏦','💎','📊','🔧','❤️','🌟','🎯']

interface CatItem { name: string; icon: string }

function CatEditor({
  title, items, onChange, accentColor
}: { title: string; items: CatItem[]; onChange: (items: CatItem[]) => void; accentColor: string }) {
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📌')
  const [showEmojiFor, setShowEmojiFor] = useState<number | 'new' | null>(null)

  const add = () => {
    if (!newName.trim()) return
    onChange([...items, { name: newName.trim(), icon: newIcon }])
    setNewName(''); setNewIcon('📌')
  }

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  const update = (i: number, patch: Partial<CatItem>) =>
    onChange(items.map((item, idx) => idx === i ? { ...item, ...patch } : item))

  return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 700, color: accentColor, marginBottom: '12px' }}>{title}</h3>

      {/* 现有类别列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#f9fafb', borderRadius: '12px' }}>
            {/* 图标选择 */}
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setShowEmojiFor(showEmojiFor === i ? null : i)}
                style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.icon}
              </button>
              {showEmojiFor === i && (
                <div style={{ position: 'absolute', zIndex: 10, top: '40px', left: 0, background: 'white', borderRadius: '14px', boxShadow: '0 6px 24px rgba(0,0,0,0.15)', padding: '10px', width: '220px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '4px', marginBottom: '8px' }}>
                    {QUICK_EMOJIS.map(e => (
                      <button key={e} type="button" onClick={() => { update(i, { icon: e }); setShowEmojiFor(null) }}
                        style={{ padding: '5px', borderRadius: '8px', border: item.icon === e ? '2px solid #6366f1' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: '18px' }}>{e}</button>
                    ))}
                  </div>
                  <input 
                    defaultValue={item.icon} 
                    onChange={e => update(i, { icon: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} 
                    placeholder="自定义 emoji"
                  />
                </div>
              )}
            </div>
            {/* 名称 */}
            <ImeInput 
              value={item.name} 
              onChange={v => update(i, { name: v })}
              style={{ 
                flex: 1, 
                padding: '7px 10px', 
                border: '1.5px solid #e5e7eb', 
                borderRadius: '10px', 
                fontSize: '14px', 
                outline: 'none', 
                minWidth: 0 
              } as React.CSSProperties} 
            />
            {/* 删除 */}
            <button type="button" onClick={() => remove(i)}
              style={{ background: '#fff1f2', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#ef4444', display: 'flex', flexShrink: 0 }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* 新增一行 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setShowEmojiFor(showEmojiFor === 'new' ? null : 'new')}
            style={{ width: '40px', height: '40px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#f9fafb', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {newIcon}
          </button>
          {showEmojiFor === 'new' && (
            <div style={{ position: 'absolute', zIndex: 10, top: '44px', left: 0, background: 'white', borderRadius: '14px', boxShadow: '0 6px 24px rgba(0,0,0,0.15)', padding: '10px', width: '220px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '4px', marginBottom: '8px' }}>
                {QUICK_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => { setNewIcon(e); setShowEmojiFor(null) }}
                    style={{ padding: '5px', borderRadius: '8px', border: newIcon === e ? '2px solid #6366f1' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: '18px' }}>{e}</button>
                ))}
              </div>
              <input 
                defaultValue={newIcon} 
                onChange={e => setNewIcon(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} 
                placeholder="自定义 emoji"
              />
            </div>
          )}
        </div>
        <ImeInput 
          value={newName} 
          onChange={setNewName} 
          placeholder="新类别名称"
          style={{ 
            flex: 1, 
            padding: '10px 12px', 
            border: '1.5px solid #e5e7eb', 
            borderRadius: '10px', 
            fontSize: '14px', 
            outline: 'none', 
            minWidth: 0 
          } as React.CSSProperties} 
        />
        <button type="button" onClick={add}
          style={{ background: accentColor, color: 'white', border: 'none', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Plus size={14} /> 添加
        </button>
      </div>
    </div>
  )
}

export function SystemSettings() {
  const { user } = useAppStore()
  const config = useSystemConfig()
  const [appName, setAppName] = useState(config.appName)
  const [expenseCats, setExpenseCats] = useState<CatItem[]>(config.defaultExpenseCategories)
  const [incomeCats, setIncomeCats] = useState<CatItem[]>(config.defaultIncomeCategories)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 配置加载后同步到本地 state
  useEffect(() => {
    setAppName(config.appName)
    setExpenseCats(config.defaultExpenseCategories)
    setIncomeCats(config.defaultIncomeCategories)
  }, [config])

  if (user?.role !== 'admin') return (
    <div style={{ textAlign: 'center', padding: '60px 16px', color: '#9ca3af' }}>
      <Settings size={48} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
      <p>仅管理员可访问系统设置</p>
    </div>
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      // 修复：确保 user 不为 null 时才调用（配合前面的权限判断）
      await saveSystemConfig(
        { appName, defaultExpenseCategories: expenseCats, defaultIncomeCategories: incomeCats }, 
        user.id
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      // 同步更新页面标题
      document.title = appName
    } catch (e: any) {
      alert('保存失败：' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>⚙️ 系统设置</h1>
        <button onClick={handleSave} disabled={saving}
          style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: '12px', padding: '9px 18px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>
          {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
        </button>
      </div>

      {/* 系统名称 */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Type size={16} style={{ color: '#6366f1' }} />
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>系统名称</h3>
        </div>
        <ImeInput 
          value={appName} 
          onChange={setAppName} 
          placeholder="输入系统名称"
          style={{ 
            width: '100%', 
            padding: '12px 14px', 
            border: '1.5px solid #e5e7eb', 
            borderRadius: '12px', 
            fontSize: '16px', 
            fontWeight: 600, 
            outline: 'none', 
            boxSizing: 'border-box', 
            color: '#1f2937' 
          } as React.CSSProperties} 
        />
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>修改后将显示在登录页、标题栏等位置</p>
      </div>

      {/* 默认支出类别 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Tag size={14} style={{ color: '#ef4444' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>默认支出类别</p>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>（新账本的预置类别）</span>
        </div>
        <CatEditor title="💸 支出类别" items={expenseCats} onChange={setExpenseCats} accentColor="#ef4444" />
      </div>

      {/* 默认收入类别 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Tag size={14} style={{ color: '#22c55e' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>默认收入类别</p>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>（新账本的预置类别）</span>
        </div>
        <CatEditor title="💰 收入类别" items={incomeCats} onChange={setIncomeCats} accentColor="#22c55e" />
      </div>

      {/* 底部保存按钮 */}
      <button onClick={handleSave} disabled={saving}
        style={{ padding: '15px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 700, color: 'white', background: saved ? '#22c55e' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)', transition: 'all 0.2s' }}>
        {saving ? '保存中...' : saved ? '✓ 设置已保存' : '💾 保存所有设置'}
      </button>
    </div>
  )
}