import React, { useState, useEffect } from 'react'
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, subYears } from 'date-fns'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts'
import type { Transaction, Category } from '../types'

const COLORS = ['#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0', '#00BCD4', '#FFC107', '#795548', '#607D8B']

const Statistics: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'month' | 'year'>('month')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    loadData()
  }, [selectedMonth, dateRange])

  const loadData = async () => {
    try {
      if (window.electronAPI) {
        let startDate: string, endDate: string
        
        if (dateRange === 'month') {
          startDate = `${selectedMonth}-01`
          endDate = `${selectedMonth}-31`
        } else {
          startDate = format(startOfMonth(subYears(new Date(), 1)), 'yyyy-MM-dd')
          endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd')
        }
        
        const [trans, cats] = await Promise.all([
          window.electronAPI.getTransactions({ startDate, endDate }),
          window.electronAPI.getCategories()
        ])
        
        setTransactions(trans)
        setCategories(cats)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(value)
  }

  // 月度收支趋势
  const getMonthlyTrend = () => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 11),
      end: new Date()
    })
    
    return months.map(monthDate => {
      const monthStr = format(monthDate, 'yyyy-MM')
      const monthTransactions = transactions.filter(t => t.date.startsWith(monthStr))
      
      return {
        month: format(monthDate, 'MM月'),
        收入: monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        支出: monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      }
    })
  }

  // 分类统计
  const getCategoryStats = (type: 'income' | 'expense') => {
    const stats: Record<string, number> = {}
    
    transactions
      .filter(t => t.type === type)
      .forEach(t => {
        stats[t.category] = (stats[t.category] || 0) + t.amount
      })
    
    return Object.entries(stats)
      .map(([name, value]) => ({
        name: categories.find(c => c.name === name)?.icon + ' ' + name || name,
        value
      }))
      .sort((a, b) => b.value - a.value)
  }

  // 每日趋势
  const getDailyTrend = () => {
    const startDate = new Date(`${selectedMonth}-01`)
    const endDate = endOfMonth(startDate)
    
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    
    return days.map(dayDate => {
      const dateStr = format(dayDate, 'yyyy-MM-dd')
      const dayTransactions = transactions.filter(t => t.date === dateStr)
      
      return {
        day: format(dayDate, 'd'),
        收入: dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        支出: dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      }
    })
  }

  // 总计
  const totals = {
    income: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    expense: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>统计分析</h2>
        <p>收支数据可视化</p>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            className={`btn ${dateRange === 'month' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDateRange('month')}
          >
            月度
          </button>
          <button
            className={`btn ${dateRange === 'year' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDateRange('year')}
          >
            年度
          </button>
          {dateRange === 'month' && (
            <input
              type="month"
              className="form-input"
              style={{ width: 'auto' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card income">
          <div className="stat-label">{dateRange === 'month' ? '本月收入' : '年度收入'}</div>
          <div className="stat-value income">{formatCurrency(totals.income)}</div>
        </div>
        <div className="stat-card expense">
          <div className="stat-label">{dateRange === 'month' ? '本月支出' : '年度支出'}</div>
          <div className="stat-value expense">{formatCurrency(totals.expense)}</div>
        </div>
        <div className="stat-card balance">
          <div className="stat-label">结余</div>
          <div className={`stat-value ${totals.income - totals.expense >= 0 ? 'income' : 'expense'}`}>
            {formatCurrency(totals.income - totals.expense)}
          </div>
        </div>
      </div>

      {/* 收支对比柱状图 */}
      <div className="card">
        <h3 className="card-title">收支趋势</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dateRange === 'month' ? getDailyTrend() : getMonthlyTrend()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dateRange === 'month' ? 'day' : 'month'} />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="收入" fill="#10B981" />
              <Bar dataKey="支出" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* 支出分类饼图 */}
        <div className="card">
          <h3 className="card-title">支出分类</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getCategoryStats('expense')}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {getCategoryStats('expense').map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 收入分类饼图 */}
        <div className="card">
          <h3 className="card-title">收入分类</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getCategoryStats('income')}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {getCategoryStats('income').map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 分类详细列表 */}
      <div className="card">
        <h3 className="card-title">支出分类详情</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>分类</th>
                <th>金额</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              {getCategoryStats('expense').map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td className="amount-expense">{formatCurrency(item.value)}</td>
                  <td>{totals.expense > 0 ? ((item.value / totals.expense) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Statistics
