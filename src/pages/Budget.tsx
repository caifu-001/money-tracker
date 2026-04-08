import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown } from 'lucide-react'

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

export function Budget() {
  const { currentLedger } = useAppStore()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [budgets, setBudgets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTotalForm, setShowTotalForm] = useState(false)
  const [formCat, setFormCat] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [totalBudgetAmt, setTotalBudgetAmt] = useState<number>(0)
  const [totalFormAmount, setTotalFormAmount] = useState('')

  const load = async () => {
    if (!currentLedger) return
    setIsLoading(true)
    try {
      const { data: bData } = await supabase
        .from('budgets').select('*')
        .eq('ledger_id', currentLedger.id)
        .eq('year', year).eq('month', month)
      const rows = bData || []
      setBudgets(rows)
      // 读取总预算（category = '__TOTAL__' 的行）
      const totalRow = rows.find((b: any) => b.category === '__TOTAL__')
      setTotalBudgetAmt(totalRow ? totalRow.amount : 0)

      const monthStr = String(month).padStart(2, '0')
      const startDate = `${year}-${monthStr}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`
      const { data: tData } = await supabase.from('transactions').select('*')
        .eq('ledger_id', currentLedger.id).eq('type', 'expense')
        .gte('date', startDate).lte('date', endDate)
      console.log('Transactions query:', { startDate, endDate, count: tData?.length })
      setTransactions(tData || [])
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  useEffect(() => { load() }, [currentLedger, year, month])

  // 按类别聚合支出
  const spentByCategory: Record<string, number> = {}
  transactions.forEach((t: any) => {
    const cat = t.category?.split('›').pop()?.trim() || t.category || '其他'
    spentByCategory[cat] = (spentByCategory[cat] || 0) + t.amount
  })
  console.log('Spent by category:', spentByCategory, 'transactions:', transactions.length)

  // 总预算（所有分类预算之和）
  const totalBudget = budgets.filter((b: any) => b.category !== '__TOTAL__').reduce((s, b) => s + b.amount, 0)
  // 有效总预算：优先用 __TOTAL__，没有则用分类预算之和
  const effectiveTotal = totalBudgetAmt > 0 ? totalBudgetAmt : totalBudget
  const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0)
  const remaining = effectiveTotal - totalSpent
  const progress = effectiveTotal > 0 ? (totalSpent / effectiveTotal) * 100 : 0
  const overBudget = totalSpent > effectiveTotal && effectiveTotal > 0
  const overPercent = overBudget ? Math.round((totalSpent / effectiveTotal) * 100) : 0

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCat.trim() || !formAmount || parseFloat(formAmount) <= 0) { alert('请填写类别和金额'); return }
    // upsert
    const existing = budgets.find(b => b.category === formCat.trim())
    if (existing) {
      await supabase.from('budgets').update({ amount: parseFloat(formAmount) }).eq('id', existing.id)
    } else {
      await supabase.from('budgets').insert([{
        ledger_id: currentLedger?.id, category: formCat.trim(),
        amount: parseFloat(formAmount), year, month,
      }])
    }
    setFormCat(''); setFormAmount(''); setShowForm(false); load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('budgets').delete().eq('id', id)
    load()
  }

  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '16px 16px 100px' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937' }}>💰 预算管理</h1>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>设置每月各类别支出上限</p>
      </div>

      {/* 月份选择 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer' }}>
          {[2024,2025,2026].map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer' }}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
      </div>

      {/* 总览卡片 */}
      <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 20, padding: '20px 20px 24px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}/>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 12 }}>{isCurrentMonth ? '📌 本月' : `📅 ${year}年${month}月`} 预算概览</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px' }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>总预算</p>
            <p style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>¥{effectiveTotal.toFixed(2)}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px' }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>已支出</p>
            <p style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>¥{totalSpent.toFixed(2)}</p>
          </div>
        </div>

        {/* 进度条 */}
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            width: `${Math.min(progress, 100)}%`, height: '100%', borderRadius: 8,
            background: overBudget ? '#ef4444' : progress > 80 ? '#f59e0b' : '#22c55e',
            transition: 'width 0.3s',
          }}/>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: overBudget ? '#fca5a5' : 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            {overBudget ? `⚠️ 已超支 ${overPercent}%` : `剩余 ¥${remaining.toFixed(2)}`}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
            {effectiveTotal > 0 ? `${Math.round(progress)}%` : '未设置预算'}
          </p>
        </div>
      </div>

      {/* 添加预算按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>📊 预算设置</p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setShowTotalForm(!showTotalForm); setShowForm(false) }}
            style={{ background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 10, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            💰 总预算
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowTotalForm(false) }}
            style={{ background: '#eef2ff', color: '#6366f1', border: 'none', borderRadius: 10, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            + 分类预算
          </button>
        </div>
      </div>

      {/* 设置总预算表单 */}
      {showTotalForm && (
        <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginBottom: 14 }}>💰 设置总预算</p>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const amt = parseFloat(totalFormAmount)
            if (!amt || amt <= 0) { alert('请输入有效的金额'); return }
            if (totalBudgetAmt > 0) {
              await supabase.from('budgets').update({ amount: amt }).eq('ledger_id', currentLedger?.id).eq('year', year).eq('month', month).eq('category', '__TOTAL__')
            } else {
              await supabase.from('budgets').insert([{ ledger_id: currentLedger?.id, category: '__TOTAL__', amount: amt, year, month }])
            }
            setTotalFormAmount(''); setShowTotalForm(false); load()
          }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="number" value={totalFormAmount} onChange={e => setTotalFormAmount(e.target.value)}
                placeholder="输入总预算金额（元）" min={0}
                style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
              <button type="submit" style={{ padding: '11px 20px', borderRadius: 12, border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>保存</button>
              {totalBudgetAmt > 0 && (
                <button type="button" onClick={async () => {
                  await supabase.from('budgets').delete().eq('ledger_id', currentLedger?.id).eq('year', year).eq('month', month).eq('category', '__TOTAL__')
                  setShowTotalForm(false); load()
                }} style={{ padding: '11px 16px', borderRadius: 12, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>清除</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* 设置预算表单 */}
      {showForm && (
        <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginBottom: 14 }}>💰 设置预算</p>
          <form onSubmit={handleSetBudget}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>类别名称</label>
                <input type="text" value={formCat} onChange={e => setFormCat(e.target.value)}
                  placeholder="如：餐饮"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>预算金额（元）</label>
                <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)}
                  placeholder="如：3000"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit"
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                ✓ 保存
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 分类预算列表 */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}/>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>加载中...</p>
        </div>
      ) : budgets.length === 0 && Object.keys(spentByCategory).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 20 }}>
          <p style={{ fontSize: 44, marginBottom: 12 }}>📊</p>
          <p style={{ color: '#9ca3af', fontWeight: 600, fontSize: 15 }}>暂无预算数据</p>
          <p style={{ color: '#d1d5db', fontSize: 13, marginTop: 6 }}>点击「设置预算」添加</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 预算列表（过滤掉总预算行） */}
          {budgets.filter((b: any) => b.category !== '__TOTAL__').map(b => {
            const spent = spentByCategory[b.category] || 0
            const pct = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0
            const over = spent > b.amount && b.amount > 0
            return (
              <div key={b.id} style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{b.category}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      已花费 ¥{spent.toFixed(2)} / 预算 ¥{b.amount.toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: over ? '#ef4444' : '#374151' }}>
                      {over ? '+' : ''}{(spent - b.amount).toFixed(2)}
                    </span>
                    <button onClick={() => handleDelete(b.id)} style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11 }}>🗑</span>
                    </button>
                  </div>
                </div>
                <div style={{ background: '#f3f4f6', borderRadius: 6, height: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e', transition: 'width 0.3s' }}/>
                </div>
              </div>
            )
          })}

          {/* 无预算但有支出的类别 */}
          {Object.entries(spentByCategory).filter(([cat]) => !budgets.find(b => b.category === cat)).map(([cat, spent]) => (
            <div key={cat} style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', border: '1.5px dashed #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: '#9ca3af' }}>{cat}</p>
                  <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 2 }}>未设置预算</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#ef4444' }}>¥{spent.toFixed(2)}</p>
                  <button onClick={() => { setFormCat(cat); setFormAmount(''); setShowForm(true) }}
                    style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>
                    + 设置预算
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
