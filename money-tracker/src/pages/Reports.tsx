import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { transactionService } from '../lib/services'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

export function Reports() {
  const { currentLedger } = useAppStore()
  const [expenseData, setExpenseData] = useState<any[]>([])
  const [incomeData, setIncomeData] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentLedger) return

    const loadReportData = async () => {
      setIsLoading(true)
      try {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startDate = startOfMonth.toISOString().split('T')[0]
        const endDate = now.toISOString().split('T')[0]

        const { data: transactions } = await transactionService.getTransactions(
          currentLedger.id,
          startDate,
          endDate
        )

        // 按分类统计支出
        const expenseByCategory: Record<string, number> = {}
        const incomeByCategory: Record<string, number> = {}
        const dailyTotals: Record<string, { income: number; expense: number }> = {}

        transactions?.forEach((t: any) => {
          if (t.type === 'expense') {
            expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount
          } else {
            incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount
          }

          // 按日期统计
          if (!dailyTotals[t.date]) {
            dailyTotals[t.date] = { income: 0, expense: 0 }
          }
          if (t.type === 'income') {
            dailyTotals[t.date].income += t.amount
          } else {
            dailyTotals[t.date].expense += t.amount
          }
        })

        setExpenseData(
          Object.entries(expenseByCategory).map(([name, value]) => ({
            name,
            value: Number(value)
          }))
        )

        setIncomeData(
          Object.entries(incomeByCategory).map(([name, value]) => ({
            name,
            value: Number(value)
          }))
        )

        setDailyData(
          Object.entries(dailyTotals)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, { income, expense }]) => ({
              date: date.slice(5),
              income,
              expense
            }))
        )
      } catch (error) {
        console.error('加载报表数据失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadReportData()
  }, [currentLedger])

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

  if (!currentLedger) {
    return <div className="p-4 text-center text-gray-500">请先选择账本</div>
  }

  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">可视化报表</h1>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        <div className="space-y-8">
          {/* 支出分布 */}
          {expenseData.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
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
            </div>
          )}

          {/* 收入分布 */}
          {incomeData.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
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
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h2 className="text-lg font-semibold mb-4">日趋势</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `¥${(value as number).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" name="收入" />
                  <Bar dataKey="expense" fill="#ef4444" name="支出" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {expenseData.length === 0 && incomeData.length === 0 && (
            <div className="text-center py-8 text-gray-500">暂无数据</div>
          )}
        </div>
      )}
    </div>
  )
}
