import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Plus, Star, Check, Trash2 } from 'lucide-react'

export function Ledgers() {
  const { user, currentLedger, setCurrentLedger } = useAppStore()
  const [ledgers, setLedgers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'personal' | 'family' | 'project'>('personal')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    if (!user) return
    setIsLoading(true)
    let query = supabase.from('ledgers').select('*').order('created_at', { ascending: false })
    if (user.role !== 'admin') query = query.eq('owner_id', user.id)
    const { data } = await query
    setLedgers(data || [])
    setIsLoading(false)
  }

  useEffect(() => { load() }, [user])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newName.trim()) { alert('请输入账本名称'); return }
    setCreating(true)
    const { data, error } = await supabase.from('ledgers').insert([{
      name: newName.trim(), type: newType, owner_id: user.id
    }]).select()
    setCreating(false)
    if (error) { alert(`创建失败: ${error.message}`); return }
    if (data?.[0]) {
      // 创建者自动成为账本成员
      await supabase.from('ledger_members').insert([{
        ledger_id: data[0].id, user_id: user.id, role: 'owner'
      }])
      setLedgers(prev => [data[0], ...prev])
      handleSelect(data[0])
      setShowCreate(false); setNewName('')
    }
  }

  const handleSelect = (ledger: any) => {
    setCurrentLedger(ledger)
  }

  const handleDelete = async (ledger: any) => {
    if (ledger.id === currentLedger?.id) {
      alert('当前使用的账本不能删除，请先切换到其他账本')
      return
    }
    const hasDefault = getDefaultId() === ledger.id
    if (hasDefault) {
      alert('默认账本不能删除，请先设置其他账本为默认')
      return
    }
    if (!confirm(`确定删除账本「${ledger.name}」？\n\n⚠️ 该账本所有交易记录和分类都会被删除，此操作不可恢复！`)) return

    // 删除关联数据
    await supabase.from('transactions').delete().eq('ledger_id', ledger.id)
    await supabase.from('categories').delete().eq('ledger_id', ledger.id)
    await supabase.from('budgets').delete().eq('ledger_id', ledger.id)
    await supabase.from('ledger_members').delete().eq('ledger_id', ledger.id)
    const { error } = await supabase.from('ledgers').delete().eq('id', ledger.id)
    if (error) { alert(`删除失败: ${error.message}`); return }
    setLedgers(prev => prev.filter(l => l.id !== ledger.id))
    alert('✅ 账本已删除')
  }

  const handleSetDefault = (ledger: any) => {
    localStorage.setItem('qianji_default_ledger_id', ledger.id)
    localStorage.setItem('qianji_default_ledger_name', ledger.name)
    localStorage.setItem('qianji_default_ledger_type', ledger.type)
    localStorage.setItem('qianji_default_ledger_owner', ledger.owner_id)
    handleSelect(ledger)
    setLedgers(prev => [...prev])
  }

  const getDefaultId = () => localStorage.getItem('qianji_default_ledger_id')

  const typeCfg: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
    personal: { label: '个人账本', emoji: '👤', color: '#6366f1', bg: '#eef2ff' },
    family:   { label: '家庭账本', emoji: '👨‍👩‍👧', color: '#ec4899', bg: '#fdf2f8' },
    project:  { label: '项目账本', emoji: '📁', color: '#f59e0b', bg: '#fffbeb' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '16px 16px 100px' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937' }}>📚 我的账本</h1>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>选择或创建账本，星标设为默认账本</p>
      </div>

      {/* 新建按钮 */}
      {!showCreate && (
        <button onClick={() => setShowCreate(true)}
          style={{ width: '100%', padding: '14px', borderRadius: 16, border: '2px dashed #c7d2fe', background: '#eef2ff', color: '#6366f1', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Plus size={18}/> 新建账本
        </button>
      )}

      {/* 新建表单 */}
      {showCreate && (
        <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginBottom: 14 }}>🏦 创建新账本</p>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>账本名称</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="例如：2026年日常账本"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {(['personal','family','project'] as const).map(t => (
                <button key={t} type="button" onClick={() => setNewType(t)}
                  style={{ padding: '12px 4px', borderRadius: 12, border: '2px solid', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    borderColor: newType === t ? typeCfg[t].color : '#e5e7eb',
                    background: newType === t ? typeCfg[t].bg : 'white',
                    color: newType === t ? typeCfg[t].color : '#9ca3af' }}>
                  <span style={{ fontSize: 22 }}>{typeCfg[t].emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{typeCfg[t].label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={creating}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: 14, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1 }}>
                {creating ? '创建中...' : '✓ 确认创建'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 账本列表 */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}/>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>加载中...</p>
        </div>
      ) : ledgers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 20 }}>
          <p style={{ fontSize: 52, marginBottom: 12 }}>📒</p>
          <p style={{ color: '#9ca3af', fontWeight: 600, fontSize: 15 }}>还没有账本</p>
          <p style={{ color: '#d1d5db', fontSize: 13, marginTop: 6 }}>点击上方按钮创建第一个账本</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ledgers.map(ledger => {
            const isDefault = getDefaultId() === ledger.id
            const isActive = currentLedger?.id === ledger.id
            const cfg = typeCfg[ledger.type] || typeCfg.personal

            return (
              <div key={ledger.id}>
                {/* 主卡片 */}
                <div onClick={() => handleSelect(ledger)}
                  style={{ background: 'white', borderRadius: 20, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', cursor: 'pointer', border: isActive ? `2px solid ${cfg.color}` : '2px solid transparent', transition: 'all 0.15s', position: 'relative' }}>
                  {isDefault && (
                    <div style={{ position: 'absolute', top: -10, right: 16, background: '#f59e0b', color: 'white', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }}>
                      ⭐ 默认
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {cfg.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ledger.name}</p>
                      <p style={{ fontSize: 12, color: '#9ca3af' }}>
                        {cfg.label} · {new Date(ledger.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    {isActive && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={14} color="white"/>
                      </div>
                    )}
                  </div>
                </div>

                {/* 操作栏 */}
                <div style={{ display: 'flex', gap: 8, marginTop: 6, paddingLeft: 4 }}>
                  <button onClick={() => handleSetDefault(ledger)}
                    style={{ flex: 1, padding: '8px', borderRadius: 12, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: isDefault ? '#fffbeb' : '#f9fafb',
                      color: isDefault ? '#f59e0b' : '#6b7280' }}>
                    <Star size={13} fill={isDefault ? '#f59e0b' : 'none'}/>
                    {isDefault ? '⭐ 已设默认' : '☆ 设为默认'}
                  </button>
                  <button onClick={() => handleSelect(ledger)}
                    style={{ flex: 1, padding: '8px', borderRadius: 12, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: isActive ? cfg.bg : '#f9fafb',
                      color: isActive ? cfg.color : '#6b7280' }}>
                    <Check size={13}/>
                    {isActive ? '✓ 当前账本' : '切换到此账本'}
                  </button>
                  <button onClick={() => handleDelete(ledger)}
                    style={{ padding: '8px 12px', borderRadius: 12, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: '#fef2f2', color: '#ef4444' }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
