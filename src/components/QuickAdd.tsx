import { useState, useEffect, useCallback } from 'react'
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

export function QuickAdd() {
  const { isQuickAddOpen, closeQuickAdd, currentLedger, user } = useAppStore()
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [isLoading, setIsLoading] = useState(false)
  const [catTree, setCatTree] = useState<any[]>([])
  const [selectedParent, setSelectedParent] = useState<any>(null)
  const [selectedSub, setSelectedSub] = useState<any>(null) // 第三级
  const [loadingCats, setLoadingCats] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 关闭时重置状态
  useEffect(() => {
    if (!isQuickAddOpen) {
      setCategory(''); setCategoryId('')
      setSelectedParent(null); setSelectedSub(null); setType('expense')
    }
  }, [isQuickAddOpen])

  // 加载类别
  const loadCats = useCallback(async () => {
    if (!currentLedger) return
    setLoadingCats(true); setErrorMsg('')
    try {
      const { data, error } = await supabase
        .from('categories').select('*')
        .eq('ledger_id', currentLedger.id).eq('type', type)
      if (error) throw error

      if (!data || data.length === 0) {
        const rows = (DEFAULT_CATEGORIES[type] as any[]).map(c => ({
          ledger_id: currentLedger.id, name: c.name,
          icon: c.icon || '📌', type, parent_id: null, level: 1,
        }))
        await supabase.from('categories').insert(rows).then(r => { if (r.error) console.error(r.error) })
        const fresh = await supabase.from('categories').select('*')
          .eq('ledger_id', currentLedger.id).eq('type', type)
          .then(r => { if (r.error) throw r.error; return r.data })
        setCatTree(buildTree(fresh || []))
      } else {
        setCatTree(buildTree(data))
      }
    } catch (err: any) {
      setErrorMsg(err.message || '加载失败')
      setCatTree([])
    } finally {
      setLoadingCats(false)
    }
  }, [currentLedger, type])

  useEffect(() => {
    if (isQuickAddOpen && currentLedger) loadCats()
  }, [isQuickAddOpen, currentLedger, type, loadCats])

  const handleParentClick = (parent: any) => {
    if (parent.children?.length > 0) { setSelectedParent(parent); setSelectedSub(null) }
    else { setCategory(`${parent.icon} ${parent.name}`); setCategoryId(parent.id); setSelectedParent(null); setSelectedSub(null) }
  }

  const handleSubClick = (sub: any) => {
    if (!selectedParent) return
    if (sub.children?.length > 0) { setSelectedSub(sub) } // 展开第三级
    else {
      setCategory(`${selectedParent.icon} ${selectedParent.name} › ${sub.icon} ${sub.name}`)
      setCategoryId(sub.id); setSelectedParent(null); setSelectedSub(null)
    }
  }

  const handleThirdClick = (third: any) => {
    if (!selectedParent || !selectedSub) return
    setCategory(`${selectedParent.icon} ${selectedParent.name} › ${selectedSub.icon} ${selectedSub.name} › ${third.icon} ${third.name}`)
    setCategoryId(third.id); setSelectedParent(null); setSelectedSub(null)
  }

  const handleSuccess = () => {
    closeQuickAdd()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !categoryId) { alert('请填写金额并选择分类'); return }
    setIsLoading(true); setErrorMsg('')
    try {
      // 北京时间
      const now = new Date()
      const beijingTime = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000)
      const today = beijingTime.toISOString().split('T')[0]

      const result = await supabase.from('transactions').insert({
        ledger_id: currentLedger!.id,
        user_id: user?.id,
        amount: parseFloat(amount),
        type,
        category,
        note,
        date: today,
        payment_method: paymentMethod,
      })

      if (result.error) {
        const msg = result.error?.message || JSON.stringify(result.error) || '未知错误'
        throw new Error(msg)
      }

      setAmount(''); setCategory(''); setCategoryId(''); setNote(''); setPaymentMethod('cash')
      handleSuccess()
    } catch (err: any) {
      const msg = err?.message || String(err) || '记账失败'
      alert(msg)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isQuickAddOpen) return null

  const today = new Date()
  const isExpense = type === 'expense'
  const accent = isExpense ? '#ef4444' : '#22c55e'
  const accentBg = isExpense ? '#fef2f2' : '#f0fdf4'

  return (
    <>
      {/* 遮罩 */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }} onClick={closeQuickAdd}/>

      {/* 弹窗主体 - 底部弹出，移动端不超出屏幕 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '92dvh',
        overflowY: 'auto',
        background: 'white',
        zIndex: 201,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
        padding: '16px',
        WebkitOverflowScrolling: 'touch',
        boxSizing: 'border-box',
      }}>

        {/* 顶部栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>💰 记一笔</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {today.getMonth()+1}月{today.getDate()}日 · {currentLedger?.name}
            </p>
          </div>
          <button onClick={closeQuickAdd}
            style={{ width: 36, height: 36, borderRadius: '50%', background: '#f5f5f5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color="#6b7280"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* 收支切换 */}
          <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: 16, padding: 4 }}>
            {(['expense','income'] as const).map(t => (
              <button key={t} type="button" onClick={() => { setType(t); setCategory(''); setCategoryId(''); setSelectedParent(null) }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  background: type === t ? 'white' : 'transparent',
                  color: type === t ? (t === 'expense' ? '#ef4444' : '#22c55e') : '#9ca3af',
                  boxShadow: type === t ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                }}>
                {t === 'expense' ? '💸 支出' : '💰 收入'}
              </button>
            ))}
          </div>

          {/* 金额 */}
          <div style={{ background: accentBg, borderRadius: 16, padding: '14px 14px' }}>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>金额（元）</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: accent }}>¥</span>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" autoFocus
                style={{ flex: 1, fontSize: 30, fontWeight: 900, background: 'transparent', border: 'none', outline: 'none', color: '#111', fontFamily: 'inherit' }}/>
            </div>
          </div>

          {/* 分类 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>
                📂 分类 {!category && <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 500 }}>*必选</span>}
              </p>
            </div>
            {category && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14, marginBottom: 10, background: accentBg }}>
                <Check size={15} color={accent}/><span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{category}</span>
              </div>
            )}
            {loadingCats ? (
              <div style={{ textAlign: 'center', padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Loader2 size={26} color="#6366f1" style={{ animation: 'spin 0.8s linear infinite' }}/>
                <p style={{ color: '#9ca3af', fontSize: 13 }}>加载中...</p>
              </div>
            ) : errorMsg ? (
              <div style={{ textAlign: 'center', padding: 20, background: '#fef2f2', borderRadius: 14 }}>
                <p style={{ color: '#ef4444', fontSize: 13 }}>{errorMsg}</p>
                <button type="button" onClick={loadCats} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, cursor: 'pointer', marginTop: 6 }}>重试</button>
              </div>
            ) : catTree.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', background: '#f9f9f9', borderRadius: 14 }}>
                <p style={{ fontSize: 26, marginBottom: 6 }}>📭</p>
                <p style={{ color: '#9ca3af', fontSize: 13 }}>暂无类别，请先在「类别」添加</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {catTree.map(cat => {
                    const isSelected = category === `${cat.icon} ${cat.name}`
                    return (
                      <button key={cat.id} type="button" onClick={() => handleParentClick(cat)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 4px', borderRadius: 14, border: 'none', cursor: 'pointer',
                          minHeight: 72, background: isSelected ? accent : selectedParent?.id === cat.id ? '#eef2ff' : '#f9f9f9',
                          color: isSelected ? 'white' : '#374151',
                          boxShadow: isSelected ? `0 4px 12px ${accent}40` : '0 1px 3px rgba(0,0,0,0.06)',
                        }}>
                        <span style={{ fontSize: 24 }}>{cat.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>{cat.name}</span>
                        {cat.children?.length > 0 && <span style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>›{cat.children.length}</span>}
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
                      <button type="button" onClick={() => { setSelectedParent(null); setSelectedSub(null) }} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer' }}>收起</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {selectedParent.children.map((sub: any) => {
                        const subSel = category === `${selectedParent.icon} ${selectedParent.name} › ${sub.icon} ${sub.name}`
                        return (
                          <button key={sub.id} type="button" onClick={() => handleSubClick(sub)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
                              minHeight: 64, background: subSel || selectedSub?.id === sub.id ? '#6366f1' : 'white', color: subSel || selectedSub?.id === sub.id ? 'white' : '#374151' }}>
                            <span style={{ fontSize: 22 }}>{sub.icon}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>{sub.name}</span>
                            {sub.children?.length > 0 && <span style={{ fontSize: 9, opacity: 0.7 }}>›{sub.children.length}</span>}
                          </button>
                        )
                      })}
                    </div>
                    {/* 第三级子分类 */}
                    {selectedSub && selectedSub.children?.length > 0 && (
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: '#e0e7ff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, color: '#4338ca' }}>{selectedSub.icon} {selectedSub.name} 的子分类</span>
                          <button type="button" onClick={() => setSelectedSub(null)} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 11, cursor: 'pointer' }}>收起</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          {selectedSub.children.map((third: any) => {
                            const thirdSel = category === `${selectedParent.icon} ${selectedParent.name} › ${selectedSub.icon} ${selectedSub.name} › ${third.icon} ${third.name}`
                            return (
                              <button key={third.id} type="button" onClick={() => handleThirdClick(third)}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                  minHeight: 56, background: thirdSel ? '#4338ca' : 'white', color: thirdSel ? 'white' : '#374151' }}>
                                <span style={{ fontSize: 20 }}>{third.icon}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, marginTop: 3 }}>{third.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 支付方式 */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 }}>💳 支付方式</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {PAYMENT_METHODS.map(pm => (
                <button key={pm.id} type="button" onClick={() => setPaymentMethod(pm.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 4px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    minHeight: 72, background: paymentMethod === pm.id ? pm.color : '#f9f9f9',
                    color: paymentMethod === pm.id ? 'white' : '#374151',
                    boxShadow: paymentMethod === pm.id ? `0 4px 12px ${pm.color}40` : 'none',
                  }}>
                  <span style={{ fontSize: 24 }}>{pm.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{pm.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="✏️ 添加备注（可选，50字内）" maxLength={50}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid transparent', background: '#f9f9f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>

          {/* 提交 */}
          <button type="submit" disabled={isLoading || !amount || !categoryId}
            style={{ width: '100%', padding: 15, borderRadius: 16, border: 'none', fontWeight: 800, fontSize: 16, color: 'white', cursor: 'pointer',
              background: (!amount || !categoryId || isLoading) ? '#d1d5db' : isExpense
                ? 'linear-gradient(135deg, #ef4444, #f97316)'
                : 'linear-gradient(135deg, #22c55e, #10b981)',
              boxShadow: (!amount || !categoryId || isLoading) ? 'none' : isExpense
                ? '0 8px 24px rgba(239,68,68,0.35)'
                : '0 8px 24px rgba(34,197,94,0.35)',
            }}>
            {isLoading ? '⏳ 保存中...' : `✓ 确认${isExpense ? '支出' : '收入'} ¥${amount || '0.00'}`}
          </button>
        </form>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  )
}
