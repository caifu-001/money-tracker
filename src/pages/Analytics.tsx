import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { Search } from 'lucide-react'

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#84cc16','#06b6d4','#a855f7','#f97316','#14b8a6']

const fmtYuan = (v: any) => `¥${Number(v ?? 0).toFixed(2)}`
const fmtInt = (v: any) => `¥${Number(v ?? 0)}`

type ViewType = 'expense' | 'income' | 'trend' | 'payment'
type PresetRange = 'month' | 'quarter' | 'year' | 'custom'

const today = new Date()
const fmt = (d: Date) => d.toISOString().split('T')[0]
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

const PRESET_LABELS: Record<PresetRange, string> = {
  month: '本月', quarter: '本季', year: '本年', custom: '自定义'
}

export function Analytics() {
  const { currentLedger, user } = useAppStore()
  const [viewType, setViewType] = useState<ViewType>('expense')
  const [preset, setPreset] = useState<PresetRange>('month')
  const [startDate, setStartDate] = useState(fmt(startOfMonth))
  const [endDate, setEndDate] = useState(fmt(today))
  const [searchCat, setSearchCat] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [expenseData, setExpenseData] = useState<any[]>([])
  const [incomeData, setIncomeData] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [paymentData, setPaymentData] = useState<any[]>([])
  const [totalExpense, setTotalExpense] = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const [rawData, setRawData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCustom, setShowCustom] = useState(false)

  const applyPreset = (p: PresetRange) => {
    setPreset(p)
    if (p === 'month') {
      setStartDate(fmt(startOfMonth)); setEndDate(fmt(today))
    } else if (p === 'quarter') {
      const q = Math.floor(today.getMonth() / 3) * 3
      setStartDate(fmt(new Date(today.getFullYear(), q, 1))); setEndDate(fmt(today))
    } else if (p === 'year') {
      setStartDate(fmt(new Date(today.getFullYear(), 0, 1))); setEndDate(fmt(today))
    }
  }

  const loadData = async () => {
    if (!currentLedger || !startDate || !endDate) return
    setIsLoading(true)
    try {
      let query = supabase.from('transactions').select('*')
        .eq('ledger_id', currentLedger.id)
        .gte('date', startDate).lte('date', endDate)
        .order('date', { ascending: true })
      if (user?.role !== 'admin') query = query.eq('user_id', user?.id)
      else if (user?.role === 'admin' && catFilter) query = query.eq('category', catFilter)
      const { data } = await query
      if (!data) { setIsLoading(false); return }

      setRawData(data)
      const exp: Record<string, number> = {}, inc: Record<string, number> = {}, trend: Record<string, any> = {}, pay: Record<string, number> = {}
      let tE = 0, tI = 0
      data.forEach((t: any) => {
        if (t.type === 'expense') { exp[t.category] = (exp[t.category] || 0) + t.amount; tE += t.amount }
        else { inc[t.category] = (inc[t.category] || 0) + t.amount; tI += t.amount }
        if (!trend[t.date]) trend[t.date] = { date: t.date, income: 0, expense: 0 }
        if (t.type === 'expense') trend[t.date].expense += t.amount
        else trend[t.date].income += t.amount
        const pm = t.payment_method || 'other'
        pay[pm] = (pay[pm] || 0) + t.amount
      })
      setTotalExpense(tE); setTotalIncome(tI)
      setExpenseData(Object.entries(exp).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value))
      setIncomeData(Object.entries(inc).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value))
      setTrendData(Object.entries(trend).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]: any) => ({ date: date.slice(5), ...v })))
      setPaymentData(Object.entries(pay).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value))
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  useEffect(() => { loadData() }, [currentLedger, startDate, endDate, catFilter, user])

  // 搜索匹配的类别（饼图用）
  const filteredExp = searchCat ? expenseData.filter(d => d.name.includes(searchCat)) : expenseData
  const filteredInc = searchCat ? incomeData.filter(d => d.name.includes(searchCat)) : incomeData

  // 所有类别名（用于筛选）
  const allCats = [...new Set([...expenseData, ...incomeData].map(d => d.name))]

  const Card = ({ children, style }: any) => (
    <div style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', marginBottom: 16, ...style }}>
      {children}
    </div>
  )

  const StatCard = ({ label, amount, color, bg }: any) => (
    <div style={{ background: bg || '#f9fafb', borderRadius: 16, padding: '16px 20px', flex: 1 }}>
      <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>{label}</p>
      <p style={{ color, fontSize: 22, fontWeight: 800 }}>¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
    </div>
  )

  if (!currentLedger) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>请先选择账本</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '16px 16px 100px' }}>

      {/* 标题 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937' }}>📊 收支分析</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{currentLedger.name} · {startDate} 至 {endDate}</p>
      </div>

      {/* 图表类型切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['expense','💸 支出'],['income','💰 收入'],['trend','📈 趋势'],['payment','💳 支付']] as [ViewType, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setViewType(v)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              background: viewType === v ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'white',
              color: viewType === v ? 'white' : '#6b7280',
              boxShadow: viewType === v ? '0 4px 16px rgba(99,102,241,0.3)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* 时间范围 */}
      <Card>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 10 }}>📅 时间范围</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: showCustom ? 12 : 0 }}>
          {(['month','quarter','year','custom'] as PresetRange[]).map(p => (
            <button key={p} onClick={() => { applyPreset(p); setShowCustom(p === 'custom') }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 12, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: preset === p ? '#eef2ff' : '#f3f4f6',
                color: preset === p ? '#6366f1' : '#9ca3af' }}>
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {showCustom && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreset('custom') }}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none' }}/>
            <span style={{ color: '#d1d5db', fontSize: 12 }}>→</span>
            <input type="date" value={endDate} max={fmt(today)} onChange={e => { setEndDate(e.target.value); setPreset('custom') }}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none' }}/>
          </div>
        )}
      </Card>

      {/* 类别筛选（所有视图都显示） */}
      <Card>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>🔍 筛选类别</p>
        {/* 文本搜索框 - 用 input 配合 inputMode 避免 iOS 输入法关闭问题 */}
        <div style={{ marginBottom: 10 }}>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={searchCat}
            onChange={e => setSearchCat(e.target.value)}
            placeholder="输入类别名称..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1.5px solid #e5e7eb',
              fontSize: 14,
              outline: 'none',
              background: 'white',
              boxSizing: 'border-box',
              color: '#111827',
              fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          />
        </div>
        {/* 按钮快速筛选 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => { setSearchCat(''); setCatFilter('') }}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: !catFilter ? '#6366f1' : '#f3f4f6', color: !catFilter ? 'white' : '#6b7280' }}>
            全部
          </button>
          {allCats.slice(0, 12).map(cat => (
            <button key={cat} onClick={() => setCatFilter(catFilter === cat ? '' : cat)}
              style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: catFilter === cat ? '#6366f1' : '#f3f4f6',
                color: catFilter === cat ? 'white' : '#6b7280' }}>
              {cat.length > 6 ? cat.slice(0, 6) + '...' : cat}
            </button>
          ))}
        </div>
        {searchCat && (
          <p style={{ fontSize: 12, color: '#6366f1', marginTop: 8 }}>
            🔍 搜索「{searchCat}」，找到 {filteredExp.length + filteredInc.length} 条
          </p>
        )}
      </Card>

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
        <StatCard label="💸 支出合计" amount={totalExpense} color="#ef4444" bg="#fef2f2"/>
        <StatCard label="💰 收入合计" amount={totalIncome} color="#22c55e" bg="#f0fdf4"/>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
        <StatCard label="📊 结余" amount={totalIncome - totalExpense}
          color={(totalIncome - totalExpense) >= 0 ? '#22c55e' : '#ef4444'}
          bg={(totalIncome - totalExpense) >= 0 ? '#f0fdf4' : '#fef2f2'}/>
        <StatCard label="📝 笔数" amount={rawData.length} color="#6366f1" bg="#eef2ff"/>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}/>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>加载中...</p>
        </div>
      ) : (
        <>
          {/* 支出饼图 */}
          {viewType === 'expense' && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>💸 支出分类占比</p>
              </div>
              {filteredExp.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>暂无支出数据</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={filteredExp} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        dataKey="value" paddingAngle={2}>
                        {filteredExp.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={fmtYuan}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 8 }}>
                    {filteredExp.slice(0, 8).map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < filteredExp.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }}/>
                          <span style={{ fontSize: 13, color: '#374151', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>¥{d.value.toFixed(2)}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                            ({totalExpense > 0 ? (d.value / totalExpense * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* 收入饼图 */}
          {viewType === 'income' && (
            <Card>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#1f2937', marginBottom: 16 }}>💰 收入分类占比</p>
              {filteredInc.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>暂无收入数据</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={filteredInc} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        dataKey="value" paddingAngle={2}>
                        {filteredInc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={fmtYuan}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 8 }}>
                    {filteredInc.slice(0, 8).map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < filteredInc.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }}/>
                          <span style={{ fontSize: 13, color: '#374151' }}>{d.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>¥{d.value.toFixed(2)}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                            ({totalIncome > 0 ? (d.value / totalIncome * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* 趋势图 */}
          {viewType === 'trend' && (
            <>
              {/* 柱状图 */}
              <Card>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1f2937', marginBottom: 16 }}>📊 每日收支柱状图</p>
                {trendData.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>暂无趋势数据</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={trendData} barGap={2} barCategoryGap="30%">
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.ceil(trendData.length / 8)}/>
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtInt}/>
                      <Tooltip formatter={fmtYuan}/>
                      <Bar dataKey="income" fill="#22c55e" radius={[3,3,0,0]} name="收入"/>
                      <Bar dataKey="expense" fill="#ef4444" radius={[3,3,0,0]} name="支出"/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {/* 折线图 */}
              <Card>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1f2937', marginBottom: 16 }}>📈 收支趋势折线图</p>
                {trendData.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>暂无趋势数据</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.ceil(trendData.length / 8)}/>
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtInt}/>
                      <Tooltip formatter={fmtYuan}/>
                      <Legend/>
                      <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} name="收入"/>
                      <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name="支出"/>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </>
          )}

          {/* 支付方式分析 */}
          {viewType === 'payment' && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>💳 支付方式分析</p>
              </div>
              {paymentData.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#d1d5db', padding: '40px 0', fontSize: 14 }}>暂无支付数据</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        dataKey="value" paddingAngle={2}
                        label={({ name }: any) => ({ cash:'💵', wechat:'💚', alipay:'💙', bankcard:'💳', other:'💠' }[name as string] || name)}>
                        {paymentData.map((_, i) => <Cell key={i} fill={['#f59e0b','#22c55e','#3b82f6','#8b5cf6','#6b7280'][i % 5]}/>)}
                      </Pie>
                      <Tooltip formatter={fmtYuan}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 8 }}>
                    {paymentData.map((d, i) => {
                      const labels: Record<string, string> = { cash:'💵 现金', wechat:'💚 微信', alipay:'💙 支付宝', bankcard:'💳 银行卡', other:'💠 其他' }
                      return (
                        <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < paymentData.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{labels[d.name] || d.name}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>¥{d.value.toFixed(2)}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                              ({totalExpense > 0 ? (d.value / totalExpense * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
