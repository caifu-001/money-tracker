import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import type { Budget, Category, Transaction } from '../types'

interface BudgetWithSpent extends Budget {
  spent: number
  categoryName: string
  categoryIcon: string
  categoryColor: string
}

const Budget: React.FC = () => {
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetWithSpent | null>(null)
  
  // 表单状态
  const [formCategory, setFormCategory] = useState('')
  const [formAmount, setFormAmount] = useState('')

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  const loadData = async () => {
    try {
      if (window.electronAPI) {
        const [budgetData, catData, transData] = await Promise.all([
          window.electronAPI.getBudgets(selectedMonth),
          window.electronAPI.getCategories('expense'),
          window.electronAPI.getTransactions({
            startDate: `${selectedMonth}-01`,
            endDate: `${selectedMonth}-31`
          })
        ])

        // 计算每个类别的支出
        const spentByCategory: Record<string, number> = {}
        transData
          .filter(t => t.type === 'expense')
          .forEach(t => {
            spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount
          })

        // 合并预算和支出数据
        const budgetsWithSpent: BudgetWithSpent[] = budgetData.map(b => {
          const cat = catData.find(c => c.name === b.category)
          return {
            ...b,
            spent: spentByCategory[b.category] || 0,
            categoryName: cat?.name || b.category,
            categoryIcon: cat?.icon || '📦',
            categoryColor: cat?.color || '#666'
          }
        })

        setBudgets(budgetsWithSpent)
        setCategories(catData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingBudget(null)
    setFormCategory('')
    setFormAmount('')
    setShowModal(true)
  }

  const openEditModal = (budget: BudgetWithSpent) => {
    setEditingBudget(budget)
    setFormCategory(budget.category)
    setFormAmount(budget.amount.toString())
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formCategory || !formAmount) {
      alert('请填写完整信息')
      return
    }

    const budget: Budget = {
      id: editingBudget?.id || uuidv4(),
      category: formCategory,
      amount: parseFloat(formAmount),
      month: selectedMonth
    }

    try {
      if (window.electronAPI) {
        await window.electronAPI.setBudget(budget)
        await loadData()
        setShowModal(false)
      }
    } catch (error) {
      console.error('Failed to save budget:', error)
      alert('保存失败')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(amount)
  }

  const getProgressColor = (spent: number, budget: number) => {
    const ratio = spent / budget
    if (ratio >= 1) return 'danger'
    if (ratio >= 0.8) return 'warning'
    return 'safe'
  }

  // 总预算和总支出
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>预算管理</h2>
          <p>设定支出上限，控制消费</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          + 添加预算
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="month"
            className="form-input"
            style={{ width: 'auto' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {/* 总览 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">月度预算</div>
          <div className="stat-value">{formatCurrency(totalBudget)}</div>
        </div>
        <div className="stat-card expense">
          <div className="stat-label">已支出</div>
          <div className="stat-value expense">{formatCurrency(totalSpent)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">剩余预算</div>
          <div className={`stat-value ${totalBudget - totalSpent >= 0 ? 'income' : 'expense'}`}>
            {formatCurrency(totalBudget - totalSpent)}
          </div>
        </div>
      </div>

      {/* 预算列表 */}
      <div className="card">
        <h3 className="card-title">分类预算</h3>
        
        {budgets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <div className="empty-text">还没有设置预算</div>
            <button className="btn btn-primary" onClick={openAddModal}>
              添加预算
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {budgets.map((budget) => {
              const progress = (budget.spent / budget.amount) * 100
              const progressColor = getProgressColor(budget.spent, budget.amount)
              
              return (
                <div 
                  key={budget.id} 
                  style={{ 
                    padding: '16px', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  onClick={() => openEditModal(budget)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.5rem' }}>{budget.categoryIcon}</span>
                      <span style={{ fontWeight: 500 }}>{budget.categoryName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span className="amount-expense">{formatCurrency(budget.spent)}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>/ {formatCurrency(budget.amount)}</span>
                    </div>
                  </div>
                  
                  <div className="budget-progress">
                    <div className="progress-bar">
                      <div 
                        className={`progress-fill ${progressColor}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.875rem' }}>
                    <span style={{ color: progress >= 100 ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                      {progress >= 100 ? '⚠️ 已超支!' : `已使用 ${progress.toFixed(0)}%`}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {progress < 100 ? `剩余 ${formatCurrency(budget.amount - budget.spent)}` : `超支 ${formatCurrency(budget.spent - budget.amount)}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 添加/编辑预算模态框 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingBudget ? '编辑预算' : '添加预算'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">支出类别</label>
                <select
                  className="form-select"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  required
                >
                  <option value="">请选择</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">预算金额</label>
                <input
                  type="number"
                  className="form-input"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBudget ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Budget
