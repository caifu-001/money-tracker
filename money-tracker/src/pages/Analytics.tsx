import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts'
import { Search, TrendingUp, TrendingDown, ChevronLeft, Users } from 'lucide-react'

interface AnalyticsProps {
  onBack?: () => void
}

export function Analytics({ onBack }: AnalyticsProps) {
  const { currentLedger, user } = useAppStore()
  const [searchCategory, setSearchCategory] = useState('')
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month')
  const [expenseData, setExpenseData] = useState<any[]>([])
  const [incomeData, setIncomeData] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [categoryStats, setCategoryStats] = useState<any[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [ledgerUsers, setLedgerUsers] = useState<any[]>([])
  const [showUserFilter, setShowUserFilter] = useState(false)

  useEffect(() => {
    if (!currentLedger) return

    const loadAnalytics = async () => {
      setIsLoading(true)
      try {
        // 如果是管理员，加载该账本的所有用户
        if (user?.role === 'admin') {
          const { data: members } = await supabase
            .from('ledger_members')
            .select('user_id, users(id, email, name)')
            .eq('ledger_id', currentLedger.id)

          if (members) {
            const users = members.map((m: any) => m.users).filter(Boolean)
            setLedgerUsers(users)
            if (users.length > 0 && !selectedUserId) {
              setSelectedUserId(users[0].id)
            }
          }
        }

        const now = new Date()
        let startDate: Date

        if (timeRange === 'month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        } else if (timeRange === 'quarter') {
          const quarter = Math.floor(now.getMonth() / 3)
          startDate = new Date(now.getFullYear(), quarter * 3, 1)
        } else {
          startDate = new Date(now.getFullYear(), 0, 1)
        }

        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = now.toISOString().split('T')[0]

        let query = supabase
          .from('transactions')
          .select('*')
          .eq('ledger_id', currentLedger.id)
          .gte('date', startDateStr)
          .lte('date', endDateStr)

        // 如果是普通用户，只查询自己的数据
        if (user?.role !== 'admin') {
          query = query.eq('user_id', user?.id)
        } else if (selectedUserId) {
          query = query.eq('user_id', selectedUserId)
        }

        const { data: transactions } = await query

        if (!transactions) {
          setIsLoading(false)
          return
        }

        // 按分类统计
        const expenseByCategory: Record<string, number> = {}
        const incomeByCategory: Record<string, number> = {}
        const dailyTotals: Record<string, { income: number; expense: number }> = {}
        let totalInc = 0
        let totalExp = 0

        transactions.forEach((t: any) => {
          if (t.type === 'expense') {
            expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount
            totalExp += t.amount
          } else {
            incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount
            totalInc += t.amount
          }

          if (!dailyTotals[t.date]) {
            dailyTotals[t.date] = { income: 0, expense: 0 }
          }
          if (t.type === 'income') {
            dailyTotals[t.date].income += t.amount
          } else {
            dailyTotals[t.date].expense += t.amount
          }
        })

        setTotalIncome(totalInc)
        setTotalExpense(totalExp)

        const expenseChartData = Object.entries(expenseByCategory)
          .map(([name, value]) => ({ name, value: Number(value) }))
          .sort((a, b) => b.value - a.value)

        const incomeChartData = Object.entries(incomeByCategory)
          .map(([name, value]) => ({ name, value: Number(value) }))
          .sort((a, b) => b.value - a.value)

        const dailyChartData = Object.entries(dailyTotals)
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([date, { income, expense }]) => ({
            date: date.slice(5),
            income,
            expense
          }))

        setExpenseData(expenseChartData)
        setIncomeData(incomeChartData)
        setDailyData(dailyChartData)

        if (searchCategory) {
          const categoryTransactions = transactions.filter(t => t.category === searchCategory)
          const stats = categoryTransactions.map(t => ({
            date: t.date,
            amount: t.amount,
            type: t.type,
            note: t.note
          }))
          setCategoryStats(stats)
        }
      } catch (error) {
        console.error('加载分析数据失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAnalytics()
  }, [currentLedger, timeRange, searchCategory, selectedUserId, user])

  const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF69B4', '#95E1D3', '#A8E6CF', '#FFD3B6', '#FFAAA5']

  if (!currentLedger) {
    return <div className="p-4 text-center text-gray-500">请先选择账本</div>
  }

  const currentUser = selectedUserId
    ? ledgerUsers.find(u => u.id === selectedUserId)
    : user

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <h1 className="text-2xl font-bold">📊 数据分析</h1>
        {user?.role === 'admin' && ledgerUsers.length > 1 && (
          <button
            onClick={() => setShowUserFilter(!showUserFilter)}
            className="ml-auto p-2 hover:bg-gray-100 rounded-lg transition flex items-center gap-1"
          >
            <Users size={20} />
            <span className="text-sm">用户</span>
          </button>
        )}
      </div>

      {/* 用户过滤器 */}
      {showUserFilter && user?.role === 'admin' && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-sm font-medium mb-3">选择用户查看数据：</p>
          <div className="flex flex-wrap gap-2">
            {ledgerUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedUserId(u.id)
                  setShowUserFilter(false)
                }}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  selectedUserId === u.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {u.name || u.email}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 时间范围选择 */}
      <div className="flex gap-2 mb-6">
        {(['month', 'quarter', 'year'] as const).map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timeRange === range
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === 'month' ? '本月' : range === 'quarter' ? '本季度' : '本年'}
          </button>
        ))}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-400 to-green-600 text-white p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">总收入</p>
              <p className="text-2xl font-bold">¥{totalIncome.toFixed(2)}</p>
            </div>
            <TrendingUp size={32} className="opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-400 to-red-600 text-white p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">总支出</p>
              <p className="text-2xl font-bold">¥{totalExpense.toFixed(2)}</p>
            </div>
            <TrendingDown size={32} className="opacity-50" />
          </div>
        </div>
      </div>

      {/* 结余 */}
      <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg mb-6">
        <p className="text-sm text-gray-600">结余</p>
        <p className={`text-3xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ¥{(totalIncome - totalExpense).toFixed(2)}
        </p>
        {user?.role === 'admin' && currentUser && (
          <p className="text-xs text-gray-500 mt-2">用户: {currentUser.name || currentUser.email}</p>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        <>
          {/* 支出分布 */}
          {expenseData.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
              <h2 className="text-lg font-semibold mb-4">支出分布</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ¥${(value as number).toFixed(2)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expenseData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {expenseData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="text-gray-600">¥{item.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 收入分布 */}
          {incomeData.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
              <h2 className="text-lg font-semibold mb-4">收入分布</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ¥${(value as number).toFixed(2)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {incomeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 日趋势 */}
          {dailyData.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
              <h2 className="text-lg font-semibold mb-4">日趋势</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `¥${(value as number).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#52B788" name="收入" />
                  <Line type="monotone" dataKey="expense" stroke="#FF6B6B" name="支出" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 类别搜索 */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
            <h2 className="text-lg font-semibold mb-4">类别搜索</h2>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="搜索类别..."
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {searchCategory && categoryStats.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">
                  找到 {categoryStats.length} 条 "{searchCategory}" 的记录
                </p>
                {categoryStats.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{stat.date}</p>
                      {stat.note && <p className="text-sm text-gray-500">{stat.note}</p>}
                    </div>
                    <span className={`text-lg font-bold ${stat.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.type === 'income' ? '+' : '-'}¥{stat.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {searchCategory && categoryStats.length === 0 && (
              <p className="text-center text-gray-500 py-4">暂无该类别的记录</p>
            )}
          </div>

          {/* 月度对比 */}
          {dailyData.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h2 className="text-lg font-semibold mb-4">月度对比</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `¥${(value as number).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="income" fill="#52B788" name="收入" />
                  <Bar dataKey="expense" fill="#FF6B6B" name="支出" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
