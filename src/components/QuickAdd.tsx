import React, { useState, useRef } from 'react'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'

interface QuickAddProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function QuickAdd({ isOpen, onClose, onSuccess }: QuickAddProps) {
  const { currentLedger } = useAppStore()
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('其他')
  const [loading, setLoading] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  // 打开弹窗时聚焦金额框
  if (isOpen) {
    setTimeout(() => amountRef.current?.focus(), 100)
  }

  // 简单的提交逻辑
  const handleSubmit = async () => {
    if (!currentLedger) {
      alert('请先选择账本！')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert('请输入有效的金额！')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setLoading(true)
    try {
      await supabase.from('transactions').insert([{
        ledger_id: currentLedger.id,
        user_id: user.id,
        amount: parseFloat(amount),
        type,
        category,
        date: new Date().toISOString().split('T')[0],
      }])
      onClose()
      onSuccess?.()
    } catch (err) {
      alert('记账失败：' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 500, zIndex: 201, background: '#fff',
        borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>快速记账</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button 
            onClick={() => setType('expense')}
            style={{ flex: 1, padding: 10, border: 'none', borderRadius: 8, background: type === 'expense' ? '#fee' : '#f5f5f5' }}
          >
            <TrendingDown size={16} /> 支出
          </button>
          <button 
            onClick={() => setType('income')}
            style={{ flex: 1, padding: 10, border: 'none', borderRadius: 8, background: type === 'income' ? '#efe' : '#f5f5f5' }}
          >
            <TrendingUp size={16} /> 收入
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <input
            ref={amountRef}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="输入金额"
            style={{ width: '100%', padding: 10, fontSize: 18, border: '1px solid #eee', borderRadius: 8 }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !amount}
          style={{
            width: '100%', padding: 12, border: 'none', borderRadius: 8,
            background: loading || !amount ? '#ddd' : '#6366f1',
            color: '#fff', fontSize: 16, cursor: 'pointer'
          }}
        >
          {loading ? '保存中...' : '确认记账'}
        </button>
      </div>
    </>
  )
}