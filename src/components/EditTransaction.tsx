import { useState, useEffect } from 'react'
import { X, Check, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import { DEFAULT_CATEGORIES } from '../lib/categories'

const PAYMENT_METHODS = [
  { id: 'cash',    name: '现金',   icon: '💵', color: '#16a34a' },
  { id: 'wechat',  name: '微信',   icon: '💚', color: '#07C160' },
  { id: 'alipay',  name: '支付宝', icon: '💙', color: '#1677FF' },
  { id: 'bankcard',name: '银行卡', icon: '💳', color: '#6366F1' },
]

function buildTree(data: any[]): any[] {
  const map = new Map()
  data.forEach(c => map.set(c.id, { ...c, children: [] }))
  const roots: any[] = []
  data.forEach(c => {
    const node = map.get(c.id)
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

interface EditTransactionProps {
  transaction: any
  onClose: () => void
  onSuccess: (updated: any) => void
}

export function EditTransaction({ transaction, onClose, onSuccess }: EditTransactionProps) {
  const { currentLedger, user } = useAppStore()
  const [type, setType] = useState<'income' | 'expense'>(transaction.type)
  const [amount, setAmount] = useState(String(transaction.amount))
  const [category, setCategory] = useState(transaction.category)
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState(transaction.note || '')
  const [paymentMethod, setPaymentMethod] = useState(transaction.payment_method || 'cash')
  const [date, setDate] = useState(transaction.date)
  const [isLoading, setIsLoading] = useState(false)
  const [catTree, setCatTree] = useState<any[]>([])
  const [selectedParent, setSelectedParent] = useState<any>(null)
  const [loadingCats, setLoadingCats] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!currentLedger) return
    const load = async () => {
      setLoadingCats(true)
      try {
        const { data, error } = await supabase
          .from('categories').select('*')
          .eq('ledger_id', currentLedger.id)
          .eq('type', type)
        if (error) throw error
        if (data) {
          setCatTree(buildTree(data))
          // 自动匹配当前 category：尝试找名称匹配的记录
          const raw = transaction.category || ''
          // 优先匹配完整名称，其次匹配 › 后面的部分
          const matched = data.find((c: any) =>
            c.name === raw ||
            (raw.includes('›') && c.name === raw.split('›').pop()?.trim()) ||
            (!raw.includes('›') && raw.startsWith(c.name))
          )
          setCategoryId(matched ? matched.id : data[0]?.id || '')
          setCategory(transaction.category || raw)
        }
      } catch (err: any) {
        console.error('load cats error:', err)
        setErrorMsg(err.message)
      } finally {
        setLoadingCats(false)
      }
    }
    load()
  }, [type, currentLedger])

  const handleParentClick = (parent: any) => {
    if (parent.children?.length > 0) setSelectedParent(parent)
    else { setCategory(`${parent.icon} ${parent.name}`); setCategoryId(parent.id) }
  }
  const handleSubClick = (sub: any) => {
    if (!selectedParent) return
    setCategory(`${selectedParent.icon} ${selectedParent.name} › ${sub.icon} ${sub.name}`)
    setCategoryId(sub.id)
    setSelectedParent(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !categoryId) { alert('请填写金额并选择分类'); return }
    setIsLoading(true)
    setErrorMsg('')
    try {
      const updatePayload = {
        amount: parseFloat(amount),
        type,
        category,
        note,
        payment_method: paymentMethod,
        date,
      }
      console.log('Updating transaction:', transaction.id, updatePayload)

      // 显式 await 并检查
      const res = await supabase.from('transactions').update(updatePayload).eq('id', transaction.id)
      console.log('Update result:', res)

      if (res.error) {
        alert(`保存失败: ${res.error.message}\n\n提示：如果提示权限不足，请在 Supabase 后台检查 RLS 策略。`)
        setIsLoading(false)
        return
      }

      const updated = { ...transaction, ...updatePayload }
      onSuccess(updated)
      onClose()
    } catch (err: any) {
      console.error('Save error:', err)
      alert(`保存失败: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const isExpense = type === 'expense'
  const accent = isExpense ? '#ef4444' : '#22c55e'

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/55" onClick={onClose}/>
      <div className="fixed inset-0 z-50 bg-white flex flex-col"
        style={{ borderRadius: '28px 28px 0 0', top: 0, maxHeight: '100dvh', overflowY: 'auto' }}>

        {/* 顶部 */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'white', padding: '24px 24px 16px', borderBottom: '1.5px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>✏️ 编辑账目</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>修改日期: {date}</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', background: '#f5f5f5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} color="#6b7280"/>
          </button>
        </div>

        <div style={{ padding: '0 24px 32px', overflowY: 'auto', flex: 1 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 日期 */}
            <div>
              <label style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500, display: 'block', marginBottom: 6 }}>📅 记账日期</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
            </div>

            {/* 收支切换 */}
            <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: 16, padding: 4 }}>
              {(['expense','income'] as const).map(t => (
                <button key={t} type="button" onClick={() => { setType(t); setCategory(''); setCategoryId(''); setSelectedParent(null) }}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                    background: type === t ? 'white' : 'transparent',
                    color: type === t ? (t === 'expense' ? '#ef4444' : '#22c55e') : '#9ca3af',
                    boxShadow: type === t ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {t === 'expense' ? '💸 支出' : '💰 收入'}
                </button>
              ))}
            </div>

            {/* 金额 */}
            <div style={{ background: isExpense ? '#fef2f2' : '#f0fdf4', borderRadius: 20, padding: '20px' }}>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, fontWeight: 500 }}>金额（元）</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: accent }}>¥</span>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  style={{ flex: 1, fontSize: 40, fontWeight: 900, background: 'transparent', border: 'none', outline: 'none', color: '#111', fontFamily: 'inherit' }}/>
              </div>
            </div>

            {/* 分类 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>📂 分类 {!categoryId && <span style={{ color: '#ef4444', fontSize: 12 }}>*必选</span>}</p>
              </div>

              {category && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 14, marginBottom: 12, background: isExpense ? '#fef2f2' : '#f0fdf4' }}>
                  <Check size={16} color={accent}/>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{category}</span>
                </div>
              )}

              {loadingCats ? (
                <div style={{ textAlign: 'center', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Loader2 size={28} color="#6366f1" style={{ animation: 'spin 0.8s linear infinite' }}/>
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>加载类别中...</p>
                </div>
              ) : errorMsg ? (
                <div style={{ textAlign: 'center', padding: 20, background: '#fef2f2', borderRadius: 14 }}>
                  <p style={{ color: '#ef4444', fontSize: 13 }}>{errorMsg}</p>
                </div>
              ) : catTree.length > 0 ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {catTree.map(cat => {
                      const isSelected = category === `${cat.icon} ${cat.name}`
                      return (
                        <button key={cat.id} type="button" onClick={() => handleParentClick(cat)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 4px', borderRadius: 14, border: 'none', cursor: 'pointer', minHeight: 76,
                            background: isSelected ? accent : selectedParent?.id === cat.id ? '#eef2ff' : '#f9f9f9',
                            color: isSelected ? 'white' : '#374151',
                          }}>
                          <span style={{ fontSize: 26 }}>{cat.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>{cat.name}</span>
                          {cat.children?.length > 0 && <span style={{ fontSize: 10, opacity: 0.6 }}>›{cat.children.length}</span>}
                        </button>
                      )
                    })}
                  </div>
                  {selectedParent && (
                    <div style={{ marginTop: 12, padding: 16, borderRadius: 16, background: '#f0effe', border: '2px solid #c7d2fe' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{selectedParent.icon}</span>
                          <span style={{ fontWeight: 700, color: '#4338ca' }}>{selectedParent.name}</span>
                          <span style={{ fontSize: 12, color: '#818cf8' }}>的子分类</span>
                        </div>
                        <button type="button" onClick={() => setSelectedParent(null)} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer' }}>收起</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {selectedParent.children.map((sub: any) => {
                          const subSel = category === `${selectedParent.icon} ${selectedParent.name} › ${sub.icon} ${sub.name}`
                          return (
                            <button key={sub.id} type="button" onClick={() => handleSubClick(sub)}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 4px', borderRadius: 12, border: 'none', cursor: 'pointer', minHeight: 68,
                                background: subSel ? '#6366f1' : 'white', color: subSel ? 'white' : '#374151' }}>
                              <span style={{ fontSize: 22 }}>{sub.icon}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>{sub.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, background: '#f9f9f9', borderRadius: 14 }}>
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>暂无类别，请先在「类别」添加</p>
                </div>
              )}
            </div>

            {/* 支付方式 */}
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>💳 支付方式</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.id} type="button" onClick={() => setPaymentMethod(pm.id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 4px', borderRadius: 14, border: 'none', cursor: 'pointer', minHeight: 76,
                      background: paymentMethod === pm.id ? pm.color : '#f9f9f9',
                      color: paymentMethod === pm.id ? 'white' : '#374151',
                    }}>
                    <span style={{ fontSize: 26 }}>{pm.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{pm.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 备注 */}
            <div>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="✏️ 添加备注（可选，50字内）" maxLength={50}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid transparent', background: '#f9f9f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
            </div>

            {/* 提交 */}
            <button type="submit" disabled={isLoading || !amount || !categoryId}
              style={{ width: '100%', padding: 16, borderRadius: 16, border: 'none', fontWeight: 800, fontSize: 16, color: 'white', cursor: 'pointer',
                background: (!amount || !categoryId || isLoading) ? '#d1d5db' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: (!amount || !categoryId || isLoading) ? 'none' : '0 8px 24px rgba(99,102,241,0.35)',
              }}>
              {isLoading ? '⏳ 保存中...' : '✓ 保存修改'}
            </button>
          </form>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  )
}
