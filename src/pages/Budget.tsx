import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { transactionService, budgetService } from '../lib/services'
import { supabase } from '../lib/supabase'
import { Plus } from 'lucide-react'

export function Budget() {
  const { currentLedger } = useAppStore()
  const [monthlyBudget, setMonthlyBudget] = useState<any>(null)
  const [totalSpent, setTotalSpent] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [formAmount, setFormAmount] = useState('')

  useEffect(() => {
    if (!currentLedger) return
    const load = async () => {
      setIsLoading(true)
      try {
        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()
        const { data: budgetData } = await supabase
          .from('budgets').select('*')
          .eq('ledger_id', currentLedger.id)
          .eq('category', '总预算')
          .eq('month', month).eq('year', year).single()
        if (budgetData) { setMonthlyBudget(budgetData); setFormAmount(budgetData.amount.toString()) }
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const { data: txs } = await transactionService.getTransactions(currentLedger.id, startDate, now.toISOString().split('T')[0])
        setTotalSpent(txs?.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0) || 0)
      } catch (e) { console.error(e) }
      finally { setIsLoading(false) }
    }
    load()
  }, [currentLedger])

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentLedger || !formAmount) return alert('请输入预算金额')
    try {
      const now = new Date()
      await budgetService.setBudget(currentLedger.id, '总预算', parseFloat(formAmount), now.getMonth() + 1, now.getFullYear())
      const { data } = await supabase.from('budgets').select('*').eq('ledger_id', currentLedger.id).eq('category', '总预算').eq('month', now.getMonth() + 1).eq('year', now.getFullYear()).single()
      if (data) setMonthlyBudget(data)
      setShowEditForm(false)
    } catch (e: any) { alert(e.message) }
  }

  const handleDeleteBudget = async () => {
    if (!confirm('确定删除本月预算吗？')) return
    await supabase.from('budgets').delete().eq('id', monthlyBudget.id)
    setMonthlyBudget(null); setFormAmount('')
  }

  if (!currentLedger) return (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af' }}>请先选择账本</div>
  )

  const budget = monthlyBudget?.amount || 0
  const remaining = budget - totalSpent
  const pct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0
  const pctColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f97316' : '#22c55e'

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>

      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>💰 预算管理</h1>
        {monthlyBudget && (
          <button onClick={() => setShowEditForm(!showEditForm)} style={{
            background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px',
            padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}>修改预算</button>
        )}
      </div>

      {/* 编辑表单 */}
      {showEditForm && (
        <form onSubmit={handleSetBudget} style={{ background: 'white', borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>本月预算金额</p>
          <input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)}
            placeholder="输入金额" style={{ width: '100%', padding: '12px', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '18px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{ flex: 1, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 600, cursor: 'pointer' }}>保存</button>
            <button type="button" onClick={() => setShowEditForm(false)} style={{ flex: 1, background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 600, cursor: 'pointer' }}>取消</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>加载中...</div>
      ) : monthlyBudget ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* 三格统计 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[
              { label: '本月预算', value: budget, color: '#6366f1', bg: '#eef2ff' },
              { label: '已支出', value: totalSpent, color: '#ef4444', bg: '#fff1f2' },
              { label: remaining >= 0 ? '剩余' : '超支', value: Math.abs(remaining), color: remaining >= 0 ? '#16a34a' : '#f97316', bg: remaining >= 0 ? '#f0fdf4' : '#fff7ed' },
            ].map(item => (
              <div key={item.label} style={{ background: item.bg, borderRadius: '14px', padding: '12px 10px' }}>
                <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{item.label}</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: item.color }}>¥{item.value.toFixed(0)}</p>
              </div>
            ))}
          </div>

          {/* 进度条 */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>预算使用进度</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: pctColor }}>{((totalSpent / budget) * 100).toFixed(1)}%</span>
            </div>
            <div style={{ background: '#f3f4f6', borderRadius: '99px', height: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pctColor, borderRadius: '99px', transition: 'width 0.5s' }} />
            </div>
            {remaining < 0 && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>⚠️ 已超出预算 ¥{Math.abs(remaining).toFixed(2)}</p>
            )}
          </div>

          {/* 删除按钮 */}
          <button onClick={handleDeleteBudget} style={{ background: '#fff1f2', color: '#ef4444', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
            删除本月预算
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 16px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
          <p style={{ color: '#9ca3af', fontSize: '15px', marginBottom: '24px' }}>暂无本月预算</p>
          <button onClick={() => setShowEditForm(true)} style={{
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white',
            border: 'none', borderRadius: '14px', padding: '14px 28px',
            fontSize: '15px', fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <Plus size={18} /> 设置本月预算
          </button>
        </div>
      )}
    </div>
  )
}
