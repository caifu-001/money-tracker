// src/pages/Home.tsx
import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { EditTransaction } from '../components/EditTransaction'

const PM_MAP: Record<string, string> = { cash:'现金', wechat:'微信', alipay:'支付宝', bankcard:'银行卡', other:'其他' }

export function Home() {
  const { currentLedger, user } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    if (!currentLedger || !user) return
    const load = async () => {
      setIsLoading(true)
      try {
        const today = new Date()
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const start = startOfMonth.toISOString().split('T')[0]
        const end   = today.toISOString().split('T')[0]
        let query = supabase
          .from('transactions')
          .select('*')
          .eq('ledger_id', currentLedger.id)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
        if (user.role !== 'admin') query = query.eq('user_id', user.id)
        const { data } = await query
        setTransactions(data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [currentLedger?.id, user?.id, user?.role])

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance = totalIncome - totalExpense

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条账目吗？')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const now = new Date()
  const monthLabel = `${now.getFullYear()}年${now.getMonth()+1}月`

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%)', padding: '40px 20px 48px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position:'absolute', top:'-30px', right:'-30px', width:'120px', height:'120px', background:'rgba(255,255,255,0.07)', borderRadius:'50%' }} />
        <div style={{ position:'absolute', bottom:'-40px', left:'-20px', width:'100px', height:'100px', background:'rgba(255,255,255,0.05)', borderRadius:'50%' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
          <div><p style={{ fontSize:'13px', color:'rgba(255,255,255,0.75)', marginBottom:'2px' }}>📖 {currentLedger?.name || '暂无账本'}</p><p style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)' }}>{monthLabel}</p></div>
          {user?.role === 'admin' && <span style={{ fontSize:'12px', background:'rgba(255,255,255,0.2)', color:'white', padding:'4px 12px', borderRadius:'20px', fontWeight:600 }}>🛡️ 管理员</span>}
        </div>
        <div style={{ textAlign:'center', marginBottom:'20px' }}>
          <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.7)', marginBottom:'4px' }}>本月结余</p>
          <p style={{ fontSize:'40px', fontWeight:800, color:'white', letterSpacing:'-1px' }}>¥{balance.toFixed(2)}</p>
        </div>
        <div style={{ display:'flex', gap:'12px' }}>
          {[{ label:'💚 收入', value: totalIncome },{ label:'❤️ 支出', value: totalExpense }].map(item => (
            <div key={item.label} style={{ flex:1, background:'rgba(255,255,255,0.15)', borderRadius:'14px', padding:'12px', textAlign:'center' }}>
              <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.7)' }}>{item.label}</p>
              <p style={{ fontSize:'22px', fontWeight:700, color:'rgba(255,255,255,0.9)' }}>¥{item.value.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ margin:'-16px 16px 0', background:'white', borderRadius:'20px', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={{ fontWeight:700, color:'#1f2937', fontSize:'15px' }}>本月账目</p>
          <span style={{ fontSize:'12px', color:'#9ca3af', background:'#f9fafb', padding:'3px 10px', borderRadius:'20px' }}>共 {transactions.length} 条</span>
        </div>
        {isLoading ? <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af' }}><div style={{ width:'28px', height:'28px', border:'3px solid #e0e7ff', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' }} /><p style={{ fontSize:'14px' }}>加载中...</p></div>
        : transactions.length === 0 ? <div style={{ padding:'60px 32px', textAlign:'center' }}><p style={{ fontSize:'48px', marginBottom:'12px' }}>📝</p><p style={{ fontSize:'16px', fontWeight:600, color:'#1f2937', marginBottom:'6px' }}>本月暂无账目</p><p style={{ fontSize:'13px', color:'#9ca3af' }}>点击右下角 + 开始记账</p></div>
        : transactions.map((t, i) => (
          <div key={t.id} style={{ display:'flex', alignItems:'center', padding:'12px 16px', borderBottom: i < transactions.length - 1 ? '1px solid #f9fafb' : 'none', gap:'12px' }}>
            <div style={{ width:'42px', height:'42px', borderRadius:'14px', flexShrink:0, background: t.type === 'income' ? '#f0fdf4' : '#fff1f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>
              {t.category?.match(/\p{Emoji}/u)?.[0] || (t.type === 'income' ? '💰' : '💸')}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontWeight:500, color:'#1f2937', fontSize:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.category}</p>
              <p style={{ fontSize:'12px', color:'#9ca3af', marginTop:'2px' }}>{format(new Date(t.date), 'MM月dd日 EEE', { locale: zhCN })} {t.note ? ` · ${t.note}` : ''} {t.payment_method && t.payment_method !== 'cash' ? ` · ${PM_MAP[t.payment_method]}` : ''}</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', flexShrink:0 }}>
              <span style={{ fontSize:'15px', fontWeight:700, color: t.type === 'income' ? '#16a34a' : '#dc2626' }}>{t.type === 'income' ? '+' : '-'}¥{Number(t.amount).toFixed(2)}</span>
              {(user?.role === 'admin' || t.user_id === user?.id) && <div style={{ display:'flex', gap:'4px' }}><EditTransaction transaction={t} onSuccess={()=>{}} /><button onClick={() => handleDelete(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#d1d5db', padding:'4px', borderRadius:'8px' }}>🗑</button></div>}
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}