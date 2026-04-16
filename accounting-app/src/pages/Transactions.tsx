import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import type { Transaction, Category } from '../types'

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  
  // 筛选状态
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'))
  
  // 表单状态
  const [formType, setFormType] = useState<'income' | 'expense'>('expense')
  const [formAmount, setFormAmount] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formNote, setFormNote] = useState('')

  useEffect(() => {
    loadData()
  }, [filterMonth])

  const loadData = async () => {
    try {
      if (window.electronAPI) {
        const startDate = `${filterMonth}-01`
        const endDate = `${filterMonth}-31`
        
        const [trans, cats] = await Promise.all([
          window.electronAPI.getTransactions({
            startDate,
            endDate
          }),
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

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCategory !== 'all' && t.category !== filterCategory) return false
    return true
  })

  const openAddModal = () => {
    setEditingTransaction(null)
    setFormType('expense')
    setFormAmount('')
    setFormCategory('')
    setFormDate(format(new Date(), 'yyyy-MM-dd'))
    setFormNote('')
    setShowModal(true)
  }

  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormType(transaction.type)
    setFormAmount(transaction.amount.toString())
    setFormCategory(transaction.category)
    setFormDate(transaction.date)
    setFormNote(transaction.note || '')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formAmount || !formCategory || !formDate) {
      alert('请填写完整信息')
      return
    }

    const transaction: Transaction = {
      id: editingTransaction?.id || uuidv4(),
      type: formType,
      amount: parseFloat(formAmount),
      category: formCategory,
      date: formDate,
      note: formNote
    }

    try {
      if (window.electronAPI) {
        if (editingTransaction) {
          await window.electronAPI.updateTransaction(transaction)
        } else {
          await window.electronAPI.addTransaction(transaction)
        }
        await loadData()
        setShowModal(false)
      }
    } catch (error) {
      console.error('Failed to save transaction:', error)
      alert('保存失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这条记录吗？')) return
    
    try {
      if (window.electronAPI) {
        await window.electronAPI.deleteTransaction(id)
        await loadData()
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error)
      alert('删除失败')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(amount)
  }

  const filteredCategories = categories.filter(c => c.type === formType)

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>记账</h2>
          <p>记录每一笔收支</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          + 添加记录
        </button>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="filter-item">
            <label className="form-label">月份</label>
            <input
              type="month"
              className="form-input"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label className="form-label">类型</label>
            <select
              className="form-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'income' | 'expense')}
            >
              <option value="all">全部</option>
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="form-label">类别</label>
            <select
              className="form-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">全部</option>
              {categories
                .filter(c => filterType === 'all' || c.type === filterType)
                .map(c => (
                  <option key={c.id} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>类型</th>
                <th>类别</th>
                <th>金额</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem',
                      background: t.type === 'income' ? '#D1FAE5' : '#FEE2E2',
                      color: t.type === 'income' ? '#059669' : '#DC2626'
                    }}>
                      {t.type === 'income' ? '收入' : '支出'}
                    </span>
                  </td>
                  <td>
                    {categories.find(c => c.name === t.category)?.icon} {t.category}
                  </td>
                  <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                  <td>{t.note || '-'}</td>
                  <td>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditModal(t)}
                      style={{ marginRight: '8px' }}
                    >
                      编辑
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(t.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                    暂无交易记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加/编辑模态框 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingTransaction ? '编辑记录' : '添加记录'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="type-toggle">
                <button
                  type="button"
                  className={`type-btn ${formType === 'expense' ? 'active expense' : ''}`}
                  onClick={() => {
                    setFormType('expense')
                    setFormCategory('')
                  }}
                >
                  支出
                </button>
                <button
                  type="button"
                  className={`type-btn ${formType === 'income' ? 'active income' : ''}`}
                  onClick={() => {
                    setFormType('income')
                    setFormCategory('')
                  }}
                >
                  收入
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">类别</label>
                <div className="category-grid">
                  {filteredCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className={`category-item ${formCategory === cat.name ? 'selected' : ''}`}
                      onClick={() => setFormCategory(cat.name)}
                    >
                      <span className="category-icon">{cat.icon}</span>
                      <span className="category-name">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">金额</label>
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

              <div className="form-group">
                <label className="form-label">日期</label>
                <input
                  type="date"
                  className="form-input"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">备注</label>
                <input
                  type="text"
                  className="form-input"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="可选"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTransaction ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions
