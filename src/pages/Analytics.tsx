import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts'
import { Search, TrendingUp, TrendingDown, ChevronLeft, Users } from 'lucide-react'

interface AnalyticsProps { onBack?: () => void }
const COLORS = ['#6366f1','#ec4899','#f97316','#22c55e','#06b6d4','#8b5cf6','#f59e0b','#ef4444']

export function Analytics({ onBack }: AnalyticsProps) {
  const { currentLedger, user } = useAppStore()
  const [timeRange, setTimeRange] = useState<'month'|'quarter'|'year'|'custom'>('month')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [searchInput, setSearchInput] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [expenseData, setExpenseData] = useState<any[]>([])
  const [incomeData, setIncomeData] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [categoryStats, setCategoryStats] = useState<any[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string|null>(null)
  const [ledgerUsers, setLedgerUsers] = useState<any[]>([])
  const [showUserFilter, setShowUserFilter] = useState(false)
  const debounceRef = useRef<number|null>(null)

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => setSearchCategory(value), 500)
  }
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  useEffect(() => {
    if (!currentLedger) return
    const load = async () => {
      setIsLoading(true)
      try {
        if (user?.role === 'admin') {
          const { data: members } = await supabase.from('ledger_members').select('user_id, users(id, email, name)').eq('ledger_id', currentLedger.id)
          if (members) {
            const us = members.map((m: any) => m.users).filter(Boolean)
            setLedgerUsers(us)
            if (us.length > 0 && !selectedUserId) setSelectedUserId(us[0].id)
          }
        }
        const now = new Date()
        let startStr: string, endStr: string
        if (timeRange === 'custom') {
          startStr = customStart; endStr = customEnd
        } else {
          let startDate: Date
          if (timeRange === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          else if (timeRange === 'quarter') startDate = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1)
          else startDate = new Date(now.getFullYear(), 0, 1)
          startStr = startDate.toISOString().split('T')[0]
          endStr = now.toISOString().split('T')[0]
        }

        let q = supabase.from('transactions').select('*').eq('ledger_id', currentLedger.id)
          .gte('date', startStr).lte('date', endStr)
        if (user?.role !== 'admin') q = q.eq('user_id', user?.id)
        else if (selectedUserId) q = q.eq('user_id', selectedUserId)
        const { data: txs } = await q
        if (!txs) { setIsLoading(false); return }

        const expByCat: Record<string,number> = {}, incByCat: Record<string,number> = {}
        const daily: Record<string,{income:number,expense:number}> = {}
        let totalInc = 0, totalExp = 0
        txs.forEach((t: any) => {
          if (t.type === 'expense') { expByCat[t.category] = (expByCat[t.category]||0)+t.amount; totalExp += t.amount }
          else { incByCat[t.category] = (incByCat[t.category]||0)+t.amount; totalInc += t.amount }
          if (!daily[t.date]) daily[t.date] = { income:0, expense:0 }
          daily[t.date][t.type === 'income' ? 'income' : 'expense'] += t.amount
        })
        setTotalIncome(totalInc); setTotalExpense(totalExp)
        setExpenseData(Object.entries(expByCat).map(([name,value])=>({name,value:Number(value)})).sort((a,b)=>b.value-a.value))
        setIncomeData(Object.entries(incByCat).map(([name,value])=>({name,value:Number(value)})).sort((a,b)=>b.value-a.value))
        setDailyData(Object.entries(daily).sort(([a],[b])=>a.localeCompare(b)).map(([date,{income,expense}])=>({date:date.slice(5),income,expense})))
        if (searchCategory) {
          setCategoryStats(txs.filter((t:any)=>t.category.includes(searchCategory)).map((t:any)=>({date:t.date,amount:t.amount,type:t.type,note:t.note,category:t.category})))
        } else {
          setCategoryStats([])
        }
      } catch(e){ console.error(e) }
      finally { setIsLoading(false) }
    }
    load()
  }, [currentLedger, timeRange, customStart, customEnd, searchCategory, selectedUserId, user])

  if (!currentLedger) return <div style={{textAlign:'center',padding:'48px',color:'#9ca3af'}}>请先选择账本</div>

  const card = (children: React.ReactNode) => (
    <div style={{ background:'white', borderRadius:'16px', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>{children}</div>
  )

  return (
    <div style={{ padding:'16px', paddingBottom:'80px', display:'flex', flexDirection:'column', gap:'12px' }}>

      {/* 标题栏 */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        {onBack && <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', padding:'4px', color:'#6b7280', display:'flex' }}><ChevronLeft size={22}/></button>}
        <h1 style={{ fontSize:'18px', fontWeight:700, color:'#1f2937', flex:1 }}>📊 数据分析</h1>
        {user?.role === 'admin' && ledgerUsers.length > 1 && (
          <button onClick={()=>setShowUserFilter(!showUserFilter)} style={{ display:'flex', alignItems:'center', gap:'4px', background:'#f3f4f6', border:'none', borderRadius:'10px', padding:'6px 10px', cursor:'pointer', fontSize:'13px', color:'#6b7280' }}>
            <Users size={15}/> 用户
          </button>
        )}
      </div>

      {/* 用户筛选 */}
      {showUserFilter && card(
        <div>
          <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'8px' }}>选择用户：</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
            {ledgerUsers.map(u=>(
              <button key={u.id} onClick={()=>{setSelectedUserId(u.id);setShowUserFilter(false)}} style={{
                padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600,
                background: selectedUserId===u.id ? '#6366f1' : '#f3f4f6',
                color: selectedUserId===u.id ? 'white' : '#6b7280'
              }}>{u.name||u.email}</button>
            ))}
          </div>
        </div>
      )}

      {/* 时间范围 */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
        {([
          { key:'month', label:'本月' },
          { key:'quarter', label:'本季度' },
          { key:'year', label:'本年' },
          { key:'custom', label:'自定义' },
        ] as const).map(r=>(
          <button key={r.key} onClick={()=>setTimeRange(r.key)} style={{
            flex:1, minWidth:'60px', padding:'9px 0', borderRadius:'12px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:600,
            background: timeRange===r.key ? '#6366f1' : '#f3f4f6',
            color: timeRange===r.key ? 'white' : '#6b7280'
          }}>{r.label}</button>
        ))}
      </div>

      {/* 自定义时间段选择器 */}
      {timeRange === 'custom' && (
        <div style={{ background:'white', borderRadius:'14px', padding:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'10px', fontWeight:600 }}>选择时间范围</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'4px' }}>开始日期</p>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                style={{ width:'100%', padding:'9px 10px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'13px', outline:'none', boxSizing:'border-box', color:'#1f2937' }}/>
            </div>
            <div>
              <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'4px' }}>结束日期</p>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                style={{ width:'100%', padding:'9px 10px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'13px', outline:'none', boxSizing:'border-box', color:'#1f2937' }}/>
            </div>
          </div>
          {customStart && customEnd && (
            <p style={{ fontSize:'12px', color:'#6366f1', marginTop:'8px', textAlign:'center' }}>
              📅 {customStart} 至 {customEnd}
            </p>
          )}
        </div>
      )}

      {/* 收支卡片 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        <div style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', borderRadius:'16px', padding:'14px', color:'white' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <p style={{ fontSize:'12px', opacity:0.85, marginBottom:'4px' }}>总收入</p>
              <p style={{ fontSize:'20px', fontWeight:700 }}>¥{totalIncome.toFixed(2)}</p>
            </div>
            <TrendingUp size={28} style={{ opacity:0.5 }}/>
          </div>
        </div>
        <div style={{ background:'linear-gradient(135deg,#ef4444,#dc2626)', borderRadius:'16px', padding:'14px', color:'white' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <p style={{ fontSize:'12px', opacity:0.85, marginBottom:'4px' }}>总支出</p>
              <p style={{ fontSize:'20px', fontWeight:700 }}>¥{totalExpense.toFixed(2)}</p>
            </div>
            <TrendingDown size={28} style={{ opacity:0.5 }}/>
          </div>
        </div>
      </div>

      {/* 结余 */}
      <div style={{ background: totalIncome-totalExpense>=0 ? '#f0fdf4' : '#fff1f2', borderRadius:'16px', padding:'14px', border:`2px solid ${totalIncome-totalExpense>=0?'#bbf7d0':'#fecaca'}` }}>
        <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'4px' }}>结余</p>
        <p style={{ fontSize:'28px', fontWeight:700, color: totalIncome-totalExpense>=0?'#16a34a':'#ef4444' }}>
          ¥{(totalIncome-totalExpense).toFixed(2)}
        </p>
      </div>

      {/* 类别搜索（放在最前面，方便使用） */}
      {card(<>
        <h2 style={{ fontSize:'15px', fontWeight:700, color:'#1f2937', marginBottom:'12px' }}>🔍 类别搜索</h2>
        <div style={{ position:'relative', marginBottom:'12px' }}>
          <Search size={16} style={{ position:'absolute', left:'12px', top:'11px', color:'#9ca3af' }}/>
          <input
            type="text" placeholder="输入类别名称搜索..." value={searchInput}
            onChange={e=>handleSearchChange(e.target.value)}
            style={{ width:'100%', paddingLeft:'36px', paddingRight:'12px', paddingTop:'10px', paddingBottom:'10px', border:'1.5px solid #e5e7eb', borderRadius:'12px', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
          />
        </div>
        {searchInput && categoryStats.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'4px' }}>找到 {categoryStats.length} 条记录</p>
            {categoryStats.map((s,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#f9fafb', borderRadius:'10px' }}>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:500, color:'#374151' }}>{s.category} · {s.date}</p>
                  {s.note && <p style={{ fontSize:'12px', color:'#9ca3af' }}>{s.note}</p>}
                </div>
                <span style={{ fontWeight:700, fontSize:'14px', color: s.type==='income'?'#16a34a':'#ef4444' }}>
                  {s.type==='income'?'+':'-'}¥{s.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
        {searchInput && categoryStats.length === 0 && !isLoading && (
          <p style={{ textAlign:'center', color:'#9ca3af', padding:'16px 0', fontSize:'13px' }}>暂无该类别的记录</p>
        )}
      </>)}

      {isLoading ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>
          <div style={{ width:'28px', height:'28px', border:'3px solid #e0e7ff', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 8px' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          加载中...
        </div>
      ) : <>
        {/* 支出饼图 - 修复 percent 可能为 undefined 的 TS 报错 */}
        {expenseData.length > 0 && card(<>
          <h2 style={{ fontSize:'15px', fontWeight:700, color:'#1f2937', marginBottom:'12px' }}>支出分布</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={expenseData} cx="50%" cy="50%" outerRadius={80} dataKey="value" labelLine={false} 
              label={({name,percent})=>`${name} ${percent ? (percent*100).toFixed(0) : 0}%`}>
              {expenseData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie></PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop:'8px', display:'flex', flexDirection:'column', gap:'6px' }}>
            {expenseData.map((item,i)=>(
              <div key={item.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', background:'#f9fafb', borderRadius:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:COLORS[i%COLORS.length], flexShrink:0 }}/>
                  <span style={{ fontSize:'13px', color:'#374151' }}>{item.name}</span>
                </div>
                <span style={{ fontSize:'13px', fontWeight:600, color:'#ef4444' }}>¥{item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </>)}

        {/* 收入饼图 - 修复 percent 可能为 undefined 的 TS 报错 */}
        {incomeData.length > 0 && card(<>
          <h2 style={{ fontSize:'15px', fontWeight:700, color:'#1f2937', marginBottom:'12px' }}>收入分布</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={incomeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" labelLine={false} 
              label={({name,percent})=>`${name} ${percent ? (percent*100).toFixed(0) : 0}%`}>
              {incomeData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie></PieChart>
          </ResponsiveContainer>
        </>)}

        {/* 趋势折线图 */}
        {dailyData.length > 0 && card(<>
          <h2 style={{ fontSize:'15px', fontWeight:700, color:'#1f2937', marginBottom:'12px' }}>收支趋势</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="date" tick={{fontSize:11}} />
              <YAxis tick={{fontSize:11}} />
              <Tooltip formatter={(v)=>`¥${(v as number).toFixed(2)}`}/>
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#22c55e" name="收入" dot={false} strokeWidth={2}/>
              <Line type="monotone" dataKey="expense" stroke="#ef4444" name="支出" dot={false} strokeWidth={2}/>
            </LineChart>
          </ResponsiveContainer>
        </>)}

        {/* 柱状图 */}
        {dailyData.length > 0 && card(<>
          <h2 style={{ fontSize:'15px', fontWeight:700, color:'#1f2937', marginBottom:'12px' }}>日收支对比</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="date" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip formatter={(v)=>`¥${(v as number).toFixed(2)}`}/>
              <Legend />
              <Bar dataKey="income" fill="#22c55e" name="收入" radius={[4,4,0,0]}/>
              <Bar dataKey="expense" fill="#ef4444" name="支出" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </>)}

        {expenseData.length === 0 && incomeData.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>📊</div>
            <p>暂无数据</p>
          </div>
        )}
      </>}
    </div>
  )
}