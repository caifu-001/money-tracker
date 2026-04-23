// check_budget.js - 诊断预算页问题
// 在 money-tracker-miniapp 目录下运行: node check_budget.js
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  'https://abkscyijuvkfeazhlquz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'
)
const now = new Date()
const year = now.getFullYear(), month = now.getMonth() + 1
const startDate = `${year}-${String(month).padStart(2,'0')}-01`
const lastDay = new Date(year, month, 0).getDate()
const endDate = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

;(async () => {
  // 1. 所有账本
  const { data: ledgers } = await supabase.from('ledgers').select('id,name')
  console.log('=== 账本 ===')
  ledgers?.forEach(l => console.log(`"${l.name}" ${l.id}`))

  // 2. 本月支出（分类格式）
  const { data: txs } = await supabase.from('transactions')
    .select('category,amount,ledger_id')
    .eq('type','expense').gte('date',startDate).lte('date',endDate)
  console.log(`\n=== 本月支出 ${txs?.length || 0} 笔 ===`)
  const map = {}
  txs?.forEach(t => {
    const raw = t.category||'其他'
    const key = raw.split('›').pop().trim()
    map[key] = (map[key]||0) + t.amount
  })
  Object.entries(map).forEach(([k,v]) => console.log(`  ${k}: ${Math.round(v*100)/100}`))

  // 3. budgets 表
  const { data: budgets } = await supabase.from('budgets')
    .select('category,amount,ledger_id').eq('year',year).eq('month',month)
  console.log('\n=== 预算设置 ===')
  budgets?.forEach(b => console.log(`  "${b.category}": ${b.amount}`))

  // 4. categories 表名
  const { data: cats } = await supabase.from('categories').select('name,level').limit(30)
  console.log('\n=== 数据库类别 (前30) ===')
  cats?.forEach(c => console.log(`  level=${c.level} name="${c.name}"`))
})()
