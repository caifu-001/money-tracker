import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { Transaction, Category, Statistics } from '../types'

const COLORS = ['#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0', '#00BCD4', '#FFC107', '#795548']

const Dashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const now = new Date()
      const startDate = format(startOfMonth(now), 'yyyy-MM-dd')
      const endDate = format(endOfMonth(now), 'yyyy-MM-dd')

      if (window.electronAPI) {
        const [stats, cats] = await Promise.all([
          window.electronAPI.getStatistics(startDate, endDate),
          window.electronAPI.getCategories()
        ])
        setStatistics(stats)
        setCategories(cats)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(amount)
  }

  const getCategoryPieData = (type: 'income' | 'expense') => {
    if (!statistics) return []
    
    return Object.entries(statistics.categoryStats)
      .filter(([_, stats]) => stats[type] > 0)
      .map(([category, stats]) => ({
        name: categories.find(c => c.name === category)?.icon + ' ' + category || category,
        value: stats[type]
      }))
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>本月概览</h2>
        <p>{format(new Date(), 'yyyy年MM月')}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card income">
          <div className="stat-label">本月收入</div>
          <div className="stat-value income">
            {formatCurrency(statistics?.totalIncome || 0)}
          </div>
        </div>
        <div className="stat-card expense">
          <div className="stat-label">本月支出</div>
          <div className="stat-value expense">
            {formatCurrency(statistics?.totalExpense || 0)}
          </div>
        </div>
        <div className="stat-card balance">
          <div className="stat-label">结余</div>
          <div className={`stat-value ${(statistics?.balance || 0) >= 0 ? 'income' : 'expense'}`}>
            {formatCurrency(statistics?.balance || 0)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        <div className="card">
          <h3 className="card-title">支出分类</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getCategoryPieData('expense')}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getCategoryPieData('expense').map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">收入分类</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getCategoryPieData('income')}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getCategoryPieData('income').map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">最近交易</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>类别</th>
                <th>备注</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              {statistics?.transactions.slice(0, 10).map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>
                    {categories.find(c => c.name === t.category)?.icon} {t.category}
                  </td>
                  <td>{t.note || '-'}</td>
                  <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {(!statistics?.transactions || statistics.transactions.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    暂无交易记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
