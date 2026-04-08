import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Plus, BookOpen, Check } from 'lucide-react'

const typeLabels: Record<string, string> = { personal: '👤 个人', family: '👨‍👩‍👧 家庭', project: '📁 项目' }
const typeColors: Record<string, string> = { personal: '#6366f1', family: '#ec4899', project: '#f97316' }

export function Ledgers() {
  const { user, currentLedger, setCurrentLedger } = useAppStore()
  const [ledgers, setLedgers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'personal' | 'family' | 'project'>('personal')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setIsLoading(true)
      let q = supabase.from('ledgers').select('*').order('created_at', { ascending: false })
      if (user.role !== 'admin') q = q.eq('owner_id', user.id)
      const { data } = await q
      setLedgers(data || [])
      setIsLoading(false)
    }
    load()
  }, [user])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return alert('请输入账本名称')
    const { data, error } = await supabase.from('ledgers').insert([{ name, type, owner_id: user!.id }]).select()
    if (error) return alert(error.message)
    if (data?.[0]) { setLedgers([data[0], ...ledgers]); setCurrentLedger(data[0]); setName(''); setShowForm(false) }
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>

      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>
          {user?.role === 'admin' ? '📚 所有账本' : '📚 我的账本'}
        </h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          width: '36px', height: '36px', borderRadius: '12px',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color: 'white', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Plus size={20} />
        </button>
      </div>

      {/* 创建表单 */}
      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'white', borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>新建账本</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="账本名称"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '10px' }} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {(['personal', 'family', 'project'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)} style={{
                flex: 1, padding: '8px 4px', borderRadius: '10px', border: '1.5px solid',
                borderColor: type === t ? typeColors[t] : '#e5e7eb',
                background: type === t ? typeColors[t] + '15' : 'white',
                color: type === t ? typeColors[t] : '#9ca3af',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer'
              }}>{typeLabels[t]}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{ flex: 1, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 600, cursor: 'pointer' }}>创建</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 600, cursor: 'pointer' }}>取消</button>
          </div>
        </form>
      )}

      {/* 列表 */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>加载中...</div>
      ) : ledgers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 16px' }}>
          <BookOpen size={48} style={{ color: '#e5e7eb', margin: '0 auto 12px' }} />
          <p style={{ color: '#9ca3af' }}>暂无账本，点击右上角创建</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ledgers.map(ledger => {
            const active = currentLedger?.id === ledger.id
            const color = typeColors[ledger.type] || '#6366f1'
            return (
              <div key={ledger.id} onClick={() => setCurrentLedger(ledger)} style={{
                background: 'white', borderRadius: '16px', padding: '14px 16px',
                border: `2px solid ${active ? color : '#f3f4f6'}`,
                cursor: 'pointer', transition: 'border-color 0.15s',
                boxShadow: active ? `0 4px 16px ${color}25` : '0 1px 4px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '15px', color: '#1f2937', marginBottom: '4px' }}>{ledger.name}</p>
                    <p style={{ fontSize: '12px', color: color, fontWeight: 500 }}>{typeLabels[ledger.type]}</p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      {new Date(ledger.created_at).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  {active && (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={16} color="white" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
