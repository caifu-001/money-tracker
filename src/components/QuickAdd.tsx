import { useState, useEffect, useCallback } from 'react'
import { X, Check, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import { DEFAULT_CATEGORIES } from '../lib/categories'
import { LOAN_CATEGORY, recentCounterparties } from '../lib/loans'

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
  const { isQuickAddOpen, closeQuickAdd, currentLedger, user, transactions } = useAppStore()
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [isReimbursable, setIsReimbursable] = useState(false)
  // 借款：开启后隐藏分类，改填对方；金额仍计入资金流但不计收支
  const [isLoan, setIsLoan] = useState(false)
  const [counterparty, setCounterparty] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [catTree, setCatTree] = useState<any[]>([])
  const [selectedParent, setSelectedParent] = useState<any>(null)
  const [selectedSub, setSelectedSub] = useState<any>(null) // 第三级
  const [loadingCats, setLoadingCats] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [date, setDate] = useState('')

  // 关闭时重置状态
  useEffect(() => {
    if (!isQuickAddOpen) {
      setCategory(''); setCategoryId('')
      setSelectedParent(null); setSelectedSub(null); setType('expense')
      setIsLoan(false); setCounterparty(''); setIsReimbursable(false)
      const t = new Date(); const y = t.getFullYear(); const m = String(t.getMonth()+1).padStart(2,'0'); const d = String(t.getDate()).padStart(2,'0')
      setDate(''+y+'-'+m+'-'+d)
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

  // 初始化默认日期
  useEffect(() => {
    const t = new Date(); const y = t.getFullYear(); const m = String(t.getMonth()+1).padStart(2,'0'); const d = String(t.getDate()).padStart(2,'0')
    setDate(''+y+'-'+m+'-'+d)
  }, [])

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
    if (!amount) { alert('请填写金额'); return }
    if (isLoan && !counterparty.trim()) { alert('请填写借款对象（借给谁 / 向谁借）'); return }
    if (!isLoan && !categoryId) { alert('请填写金额并选择分类'); return }
    // 借款不选分类，直接写死可识别的分类名
    const finalCategory = isLoan ? LOAN_CATEGORY[type === 'expense' ? 'out' : 'in'] : category
    setIsLoading(true); setErrorMsg('')
    try {
      const result = await supabase.from('transactions').insert({
        ledger_id: currentLedger!.id,
        user_id: user?.id,
        amount: parseFloat(amount),
        type,
        category: finalCategory,
        note,
        date,
        payment_method: paymentMethod,
        is_loan: isLoan,
        loan_counterparty: isLoan ? counterparty.trim() : null,
        ...(type === 'expense' && isReimbursable && !isLoan ? { is_reimbursable: true, reimbursement_status: 'pending' } : {}),
      })

      if (result.error) {
        const msg = result.error?.message || JSON.stringify(result.error) || '未知错误'
        throw new Error(msg)
      }

      setAmount(''); setCategory(''); setCategoryId(''); setNote(''); setPaymentMethod('cash')
      setIsLoan(false); setCounterparty(''); setIsReimbursable(false)
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
  // 借款用独立配色：借出（应收）青 / 借入（应付）橙，与收支红绿区分开
  const loanAccent = isExpense ? '#0d9488' : '#ea580c'
  const loanParties = recentCounterparties(transactions, 6)
  // 借款只要金额 + 对方；普通记账要金额 + 分类
  const canSubmit = !!amount && (isLoan ? !!counterparty.trim() : !!categoryId)

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

          {/* 日期 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: '#f9f9f9' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>📅 日期</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 1, fontSize: 14, border: 'none', background: 'transparent', outline: 'none', color: '#374151', fontFamily: 'inherit' }}/>
          </div>

          {/* 分类（借款模式下隐藏，改为填写对方） */}
          <div style={{ display: isLoan ? 'none' : 'block' }}>
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

          {/* 借款开关：借出/借入是债权债务，不计入收支 */}
          <div onClick={() => { const next = !isLoan; setIsLoan(next); if (next) setIsReimbursable(false) }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 14,
              background: isLoan ? '#f0fdfa' : '#f9fafb',
              border: `1.5px solid ${isLoan ? '#5eead4' : '#e5e7eb'}`, cursor: 'pointer' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isLoan ? loanAccent : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isLoan ? loanAccent : 'white', flexShrink: 0, marginTop: 1 }}>
              {isLoan && <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>✓</span>}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: isLoan ? loanAccent : '#374151' }}>
                🤝 借款（{isExpense ? '借出给' : '向人借'}）
              </span>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, lineHeight: 1.4 }}>
                不计入收支与预算，只记录欠款与资金流。对方还钱时反向记一笔自动结清。
              </p>
            </div>
          </div>

          {/* 借款对象 */}
          {isLoan && (
            <div style={{ background: '#f0fdfa', borderRadius: 16, padding: 16, border: '1.5px solid #99f6e4' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0f766e', marginBottom: 10 }}>
                {isExpense ? '📤 借给谁' : '📥 向谁借'} <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 500 }}>*必填</span>
              </p>
              <input
                type="text"
                value={counterparty}
                onChange={e => setCounterparty(e.target.value)}
                placeholder={isExpense ? '例如：张三' : '例如：李四 / 招商银行'}
                maxLength={20}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #ccfbf1', background: 'white', fontSize: 15, fontWeight: 600, color: '#111', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              {loanParties.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {loanParties.map(p => (
                    <button key={p} type="button" onClick={() => setCounterparty(p)}
                      style={{ padding: '5px 12px', borderRadius: 14, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: counterparty === p ? loanAccent : '#ccfbf1',
                        color: counterparty === p ? 'white' : '#0f766e' }}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 报销（借款时不适用） */}
          {type === 'expense' && !isLoan && (
            <div onClick={() => setIsReimbursable(!isReimbursable)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: '#fffbeb', border: '1.5px solid #fde68a', cursor: 'pointer' }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isReimbursable ? '#d97706' : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isReimbursable ? '#d97706' : 'white', flexShrink: 0 }}>
                {isReimbursable && <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>🧾 可报销（公司公费）</span>
            </div>
          )}

          {/* 提交 */}
          <button type="submit" disabled={isLoading || !canSubmit}
            style={{ width: '100%', padding: 15, borderRadius: 16, border: 'none', fontWeight: 800, fontSize: 16, color: 'white', cursor: 'pointer',
              background: (!canSubmit || isLoading) ? '#d1d5db'
                : isLoan ? `linear-gradient(135deg, ${loanAccent}, ${isExpense ? '#14b8a6' : '#f97316'})`
                : isExpense ? 'linear-gradient(135deg, #ef4444, #f97316)'
                : 'linear-gradient(135deg, #22c55e, #10b981)',
              boxShadow: (!canSubmit || isLoading) ? 'none'
                : isLoan ? `0 8px 24px ${loanAccent}59`
                : isExpense ? '0 8px 24px rgba(239,68,68,0.35)'
                : '0 8px 24px rgba(34,197,94,0.35)',
            }}>
            {isLoading ? '⏳ 保存中...'
              : isLoan ? `✓ 确认${isExpense ? '借出' : '借入'} ¥${amount || '0.00'}`
              : `✓ 确认${isExpense ? '支出' : '收入'} ¥${amount || '0.00'}`}
          </button>
        </form>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  )
}
