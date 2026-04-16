import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Trash2, Users, ArrowDownCircle, ArrowUpCircle, Pencil, ChevronDown, Download } from 'lucide-react'
import { EditTransaction } from '../components/EditTransaction'

export function Home() {
  const { currentLedger, user, transactions, setTransactions } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [ledgerUsers, setLedgerUsers] = useState<any[]>([])
  const [showUserFilter, setShowUserFilter] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any>(null)

  useEffect(() => {
    if (!currentLedger) return
    const loadData = async () => {
      setIsLoading(true)
      try {
        if (user?.role === 'admin') {
          const { data } = await supabase
            .from('ledger_members')
            .select('user_id, users(id, email, name)')
            .eq('ledger_id', currentLedger.id)
          if (data) {
            const u = data.map((m: any) => m.users).filter(Boolean)
            setLedgerUsers(u)
            if (u.length > 0 && !selectedUserId) setSelectedUserId(u[0].id)
          }
        }
        const today = new Date()
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        let query = supabase
          .from('transactions')
          .select('*')
          .eq('ledger_id', currentLedger.id)
          .gte('date', startOfMonth.toISOString().split('T')[0])
          .lte('date', today.toISOString().split('T')[0])
          .order('created_at', { ascending: false })
        if (user?.role !== 'admin') query = query.eq('user_id', user?.id)
        else if (selectedUserId) query = query.eq('user_id', selectedUserId)
        const { data } = await query
        setTransactions(data || [])
      } catch (e) { console.error(e) }
      finally { setIsLoading(false) }
    }
    loadData()
  }, [currentLedger, user, selectedUserId, setTransactions])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条账目吗？')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(transactions.filter(t => t.id !== id))
  }

  const handleExport = async () => {
    if (!currentLedger) return
    if (!confirm(`确认导出「${currentLedger.name}」的全部记录？`)) return
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('ledger_id', currentLedger.id)
        .order('date', { ascending: true })
      if (!data || data.length === 0) {
        alert('暂无账目可导出')
        return
      }
      const headers = ['日期', '时间', '类型', '金额', '类别', '子类别', '备注', '支付方式', '记账人']
      const rows = data.map((t: any) => [
        t.date || '',
        t.created_at ? t.created_at.slice(11, 16) : '',
        t.type === 'income' ? '收入' : '支出',
        t.amount || '0',
        t.category || '',
        t.sub_category || '',
        t.note || '',
        t.payment_method || '',
        t.user_id === user?.id ? (user?.name || user?.email || '我') : ''
      ])
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentLedger.name}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('导出失败: ' + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditSuccess = (updated: any) => {
    setTransactions(transactions.map(t => t.id === updated.id ? updated : t))
    setEditingTransaction(null)
  }

  const totalIncome  = transactions.reduce((s, t) => t.type === 'income' ? s + t.amount : s, 0)
  const totalExpense = transactions.reduce((s, t) => t.type === 'expense' ? s + t.amount : s, 0)
  const balance = totalIncome - totalExpense
  const currentViewUser = selectedUserId ? ledgerUsers.find(u => u.id === selectedUserId) : user
  const todayStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })

  if (!currentLedger) return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ fontSize: 72 }}>📚</div>
      <p style={{ color: '#6b7280', fontSize: 18, fontWeight: 600, marginTop: 16 }}>还没有账本</p>
      <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 8 }}>请先在「账本」页面创建一个账本</p>
    </div>
  )

  return (
    <>
      <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: 100 }}>

        {/* 顶部渐变卡片 */}
        <div style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
          padding: '32px 24px 80px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 装饰圆 */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}/>
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}/>

          <div style={{ position: 'relative' }}>
            {/* 标题行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>📖 {currentLedger.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>{todayStr}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleExport}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, padding: '6px 14px', color: 'white', fontSize: 12, cursor: 'pointer' }}>
                  <Download size={13}/> 导出
                </button>
                {user?.role === 'admin' && ledgerUsers.length > 1 && (
                <button onClick={() => setShowUserFilter(!showUserFilter)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 20, padding: '6px 14px', color: 'white', fontSize: 12, cursor: 'pointer' }}>
                  <Users size={13}/> {currentViewUser?.name || currentViewUser?.email?.split('@')[0] || '全部'}
                  <ChevronDown size={12}/>
                </button>
                )}
              </div>
            </div>

            {/* 用户选择下拉 */}
            {showUserFilter && user?.role === 'admin' && (
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, marginBottom: 20, backdropFilter: 'blur(10px)' }}>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 10 }}>查看成员账目：</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ledgerUsers.map(u => (
                    <button key={u.id} onClick={() => { setSelectedUserId(u.id); setShowUserFilter(false) }}
                      style={{ padding: '5px 14px', borderRadius: 16, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: selectedUserId === u.id ? 'white' : 'rgba(255,255,255,0.2)',
                        color: selectedUserId === u.id ? '#6366f1' : 'rgba(255,255,255,0.85)' }}>
                      {u.name || u.email?.split('@')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 结余 */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6 }}>本月结余</p>
              <p style={{ color: 'white', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
                ¥{balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* 收支两栏 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '收入', amount: totalIncome, icon: <ArrowDownCircle size={18}/>, color: '#86efac' },
                { label: '支出', amount: totalExpense, icon: <ArrowUpCircle size={18}/>, color: '#fca5a5' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: '14px 16px', backdropFilter: 'blur(8px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: item.color }}>{item.icon}</span>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{item.label}</span>
                  </div>
                  <p style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>
                    ¥{item.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 账目列表 */}
        <div style={{ margin: '-24px 16px 0', background: 'white', borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {/* 列表头 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>📋 记账记录</p>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>共 {transactions.length} 笔</p>
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 24px' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>📝</div>
              <p style={{ color: '#9ca3af', fontWeight: 600, fontSize: 15 }}>本月暂无账目</p>
              <p style={{ color: '#d1d5db', fontSize: 13, marginTop: 6 }}>点击右下角按钮开始记账</p>
            </div>
          ) : (
            <div>
              {transactions.map((transaction, idx) => {
                const isExpense = transaction.type === 'expense'
                const amountColor = isExpense ? '#ef4444' : '#22c55e'
                const iconBg = isExpense ? '#fef2f2' : '#f0fdf4'
                const rowBorder = idx < transactions.length - 1 ? '1px solid #f9fafb' : 'none'
                const canEdit = user?.role === 'admin' || transaction.user_id === user?.id

                return (
                  <div key={transaction.id}
                    style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: rowBorder, cursor: 'pointer' }}
                    onClick={() => canEdit && setEditingTransaction(transaction)}>

                    {/* 图标 */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, marginRight: 14, flexShrink: 0, background: iconBg
                    }}>
                      {transaction.category?.split(' ')[0] || (isExpense ? '💸' : '💰')}
                    </div>

                    {/* 信息 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: '#1f2937', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {transaction.category}
                      </p>
                      <p style={{ fontSize: 12, color: '#9ca3af' }}>
                        {format(new Date(transaction.created_at || transaction.date), 'MM/dd HH:mm')}
                        {transaction.note && ` · ${transaction.note}`}
                      </p>
                    </div>

                    {/* 金额 + 操作 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: amountColor }}>
                        {isExpense ? '-' : '+'}¥{transaction.amount.toFixed(2)}
                      </span>
                      {transaction.payment_method && transaction.payment_method !== 'cash' && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {transaction.payment_method === 'wechat' ? '💚微信' :
                           transaction.payment_method === 'alipay' ? '💙支付宝' :
                           transaction.payment_method === 'bankcard' ? '💳银行卡' : ''}
                        </span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    {canEdit && (
                      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditingTransaction(transaction)}
                          style={{ width: 28, height: 28, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f5f3ff', color: '#6366f1' }}>
                          <Pencil size={13}/>
                        </button>
                        <button onClick={() => handleDelete(transaction.id)}
                          style={{ width: 28, height: 28, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fef2f2', color: '#ef4444' }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {editingTransaction && (
        <EditTransaction
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
