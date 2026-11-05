import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Transaction, Category } from '../types'

const Export: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // 导出范围
  const [exportType, setExportType] = useState<'month' | 'range'>('month')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  useEffect(() => {
    loadData()
  }, [exportType, selectedMonth, startDate, endDate])

  const loadData = async () => {
    try {
      if (window.electronAPI) {
        let start: string, end: string
        
        if (exportType === 'month') {
          start = `${selectedMonth}-01`
          end = `${selectedMonth}-31`
        } else {
          start = startDate
          end = endDate
        }
        
        const [trans, cats] = await Promise.all([
          window.electronAPI.getTransactions({ startDate: start, endDate: end }),
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(amount)
  }

  const getCategoryInfo = (categoryName: string) => {
    return categories.find(c => c.name === categoryName)
  }

  // 导出为 Excel
  const exportToExcel = () => {
    if (transactions.length === 0) {
      alert('没有数据可导出')
      return
    }

    setExporting(true)
    try {
      const data = transactions.map(t => ({
        '日期': t.date,
        '类型': t.type === 'income' ? '收入' : '支出',
        '类别': `${getCategoryInfo(t.category)?.icon || ''} ${t.category}`,
        '金额': t.amount,
        '备注': t.note || ''
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '交易记录')
      
      // 自动调整列宽
      const colWidths = [
        { wch: 12 }, // 日期
        { wch: 8 },  // 类型
        { wch: 15 }, // 类别
        { wch: 12 }, // 金额
        { wch: 30 }  // 备注
      ]
      ws['!cols'] = colWidths

      const fileName = exportType === 'month' 
        ? `记账记录_${selectedMonth}.xlsx`
        : `记账记录_${startDate}_${endDate}.xlsx`
      
      XLSX.writeFile(wb, fileName)
      alert('Excel 导出成功!')
    } catch (error) {
      console.error('Export error:', error)
      alert('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 导出为 CSV
  const exportToCSV = () => {
    if (transactions.length === 0) {
      alert('没有数据可导出')
      return
    }

    setExporting(true)
    try {
      const headers = ['日期', '类型', '类别', '金额', '备注']
      const rows = transactions.map(t => [
        t.date,
        t.type === 'income' ? '收入' : '支出',
        t.category,
        t.amount.toString(),
        t.note || ''
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      // 添加 BOM 以支持中文
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = exportType === 'month' 
        ? `记账记录_${selectedMonth}.csv`
        : `记账记录_${startDate}_${endDate}.csv`
      link.click()

      alert('CSV 导出成功!')
    } catch (error) {
      console.error('Export error:', error)
      alert('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 导出为 PDF
  const exportToPDF = () => {
    if (transactions.length === 0) {
      alert('没有数据可导出')
      return
    }

    setExporting(true)
    try {
      const doc = new jsPDF()
      
      // 标题
      doc.setFontSize(18)
      doc.text('记账报告', 105, 20, { align: 'center' })
      
      // 时间范围
      doc.setFontSize(12)
      const dateRange = exportType === 'month' 
        ? selectedMonth 
        : `${startDate} 至 ${endDate}`
      doc.text(`时间范围: ${dateRange}`, 105, 30, { align: 'center' })
      
      // 统计摘要
      const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
      const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      
      doc.setFontSize(14)
      doc.text(`总收入: ${formatCurrency(totalIncome)}`, 20, 45)
      doc.text(`总支出: ${formatCurrency(totalExpense)}`, 20, 55)
      doc.text(`结余: ${formatCurrency(totalIncome - totalExpense)}`, 20, 65)
      
      // 交易记录表格
      const tableData = transactions.map(t => [
        t.date,
        t.type === 'income' ? '收入' : '支出',
        `${getCategoryInfo(t.category)?.icon || ''} ${t.category}`,
        formatCurrency(t.amount),
        t.note || '-'
      ])

      autoTable(doc, {
        startY: 75,
        head: [['日期', '类型', '类别', '金额', '备注']],
        body: tableData,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [79, 70, 229] },
        alternateRowStyles: { fillColor: [245, 247, 250] }
      })

      const fileName = exportType === 'month' 
        ? `记账报告_${selectedMonth}.pdf`
        : `记账报告_${startDate}_${endDate}.pdf`
      
      doc.save(fileName)
      alert('PDF 导出成功!')
    } catch (error) {
      console.error('Export error:', error)
      alert('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 统计数据
  const stats = {
    count: transactions.length,
    income: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    expense: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h2>数据导出</h2>
        <p>导出您的记账数据</p>
      </div>

      <div className="card">
        <h3 className="card-title">选择导出范围</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button
              className={`btn ${exportType === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setExportType('month')}
            >
              按月份
            </button>
            <button
              className={`btn ${exportType === 'range' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setExportType('range')}
            >
              自定义范围
            </button>
          </div>

          {exportType === 'month' ? (
            <div className="form-group">
              <label className="form-label">选择月份</label>
              <input
                type="month"
                className="form-input"
                style={{ width: '200px' }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">开始日期</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">结束日期</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 数据摘要 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">交易笔数</div>
          <div className="stat-value">{stats.count}</div>
        </div>
        <div className="stat-card income">
          <div className="stat-label">总收入</div>
          <div className="stat-value income">{formatCurrency(stats.income)}</div>
        </div>
        <div className="stat-card expense">
          <div className="stat-label">总支出</div>
          <div className="stat-value expense">{formatCurrency(stats.expense)}</div>
        </div>
      </div>

      {/* 导出按钮 */}
      <div className="card">
        <h3 className="card-title">选择导出格式</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div 
            style={{ 
              padding: '24px', 
              border: '2px solid var(--border-color)', 
              borderRadius: '12px',
              textAlign: 'center',
              cursor: 'pointer'
            }}
            onClick={exportToExcel}
          >
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📊</div>
            <h4 style={{ marginBottom: '8px' }}>Excel 格式</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
              适合数据分析与编辑
            </p>
            <button 
              className="btn btn-primary" 
              disabled={exporting || stats.count === 0}
              onClick={(e) => { e.stopPropagation(); exportToExcel(); }}
            >
              {exporting ? '导出中...' : '导出 Excel'}
            </button>
          </div>

          <div 
            style={{ 
              padding: '24px', 
              border: '2px solid var(--border-color)', 
              borderRadius: '12px',
              textAlign: 'center',
              cursor: 'pointer'
            }}
            onClick={exportToCSV}
          >
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📄</div>
            <h4 style={{ marginBottom: '8px' }}>CSV 格式</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
              通用数据格式，兼容性好
            </p>
            <button 
              className="btn btn-primary" 
              disabled={exporting || stats.count === 0}
              onClick={(e) => { e.stopPropagation(); exportToCSV(); }}
            >
              {exporting ? '导出中...' : '导出 CSV'}
            </button>
          </div>

          <div 
            style={{ 
              padding: '24px', 
              border: '2px solid var(--border-color)', 
              borderRadius: '12px',
              textAlign: 'center',
              cursor: 'pointer'
            }}
            onClick={exportToPDF}
          >
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📑</div>
            <h4 style={{ marginBottom: '8px' }}>PDF 报告</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
              格式美观，适合打印存档
            </p>
            <button 
              className="btn btn-primary" 
              disabled={exporting || stats.count === 0}
              onClick={(e) => { e.stopPropagation(); exportToPDF(); }}
            >
              {exporting ? '导出中...' : '导出 PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* 数据预览 */}
      <div className="card">
        <h3 className="card-title">数据预览</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>类型</th>
                <th>类别</th>
                <th>金额</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((t) => (
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
                  <td>{getCategoryInfo(t.category)?.icon} {t.category}</td>
                  <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td>{t.note || '-'}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                    暂无数据
                  </td>
                </tr>
              )}
              {transactions.length > 10 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    ... 还有 {transactions.length - 10} 条记录
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

export default Export
