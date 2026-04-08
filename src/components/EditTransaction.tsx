import React, { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ImeInput } from './ImeInput'

const PAYMENT_METHODS = [
  { id: 'cash',    name: '现金',     icon: '💵', color: '#22c55e' },
  { id: 'wechat',  name: '微信',     icon: '💚', color: '#22c55e' },
  { id: 'alipay',  name: '支付宝',   icon: '💙', color: '#3b82f6' },
  { id: 'bankcard',name: '银行卡',   icon: '💳', color: '#6366f1' },
]

export function EditTransaction({ transaction, onSuccess, onClose }: {
  transaction: any
  onSuccess?: () => void
  onClose?: () => void
}) {
  const [type, setType] = useState<'expense' | 'income'>(transaction.type || 'expense')
  const [amount, setAmount] = useState(String(transaction.amount || ''))
  const [category, setCategory] = useState(transaction.category || '')
  const [note, setNote] = useState(transaction.note || '')
  const [date, setDate] = useState(transaction.date || '')
  const [paymentMethod, setPaymentMethod] = useState(transaction.payment_method || 'cash')
  const [isLoading, setIsLoading] = useState(false)
  const [catTree, setCatTree] = useState<any[]>([])
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  // 新增：创建遮罩层引用，方便精准控制
  const maskRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setShow(true) }, [])

  useEffect(() => {
    if (!transaction.ledger_id) return
    supabase.from('system_config').select('key,value').then(({ data }) => {
      const map: any = {}
      ;(data || []).forEach((r: any) => { map[r.key] = r.value })
      const expPresets = map['default_expense_categories'] || []
      const incPresets = map['default_income_categories'] || []
      supabase.from('categories').select('id,name,icon,type,parent_id,level')
        .eq('ledger_id', transaction.ledger_id).order('level').order('name')
        .then(({ data: dbData }) => {
          const map2: any = {}; const roots: any[] = []
          ;(dbData || []).forEach((c: any) => { map2[c.id] = { ...c, children: [] } })
          ;(dbData || []).forEach((c: any) => {
            if (c.parent_id && map2[c.parent_id]) map2[c.parent_id].children.push(map2[c.id])
            else if (!c.parent_id) roots.push(map2[c.id])
          })
          const presets = transaction.type === 'income' ? incPresets : expPresets
          const presetNames = new Set(presets.map((p: any) => p.name))
          const merged = [
            ...presets.map((p: any) => {
              const db = roots.find(r => r.name === p.name && r.type === transaction.type)
              return { ...p, id: db?.id, children: db?.children || [], hasChildren: !!(db?.children?.length) }
            }),
            ...roots.filter(r => r.type === transaction.type && !presetNames.has(r.name))
              .map(r => ({ ...r, hasChildren: !!(r.children?.length) }))
          ]
          setCatTree(merged)
        })
    })
  }, [transaction.ledger_id, transaction.type])

  // 新增：组件卸载时强制关闭遮罩（防止残留）
  useEffect(() => {
    return () => {
      if (maskRef.current) {
        maskRef.current.style.display = 'none'
        maskRef.current.style.pointerEvents = 'none'
      }
    }
  }, [])

  function handleCatTap(item: any) {
    if (item.hasChildren) {
      if (expandedKey === item.name) { setExpandedKey(null) }
      else { setExpandedKey(item.name) }
    } else {
      setCategory(item.name); setExpandedKey(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !category) return
    setIsLoading(true)
    try {
      const { error } = await supabase.from('transactions').update({
        type, amount: parseFloat(amount), category, note, date,
        payment_method: paymentMethod,
      }).eq('id', transaction.id)
      if (error) throw new Error(error.message)
      setShow(false)
      // 新增：提交成功后同步隐藏遮罩
      if (maskRef.current) {
        maskRef.current.style.opacity = '0'
        maskRef.current.style.pointerEvents = 'none'
      }
      setTimeout(() => { onSuccess?.(); onClose?.() }, 300)
    } catch (err: any) {
      alert(`修改失败：${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 重构：完善关闭逻辑，同步隐藏遮罩
  function handleClose() {
    setShow(false)
    // 核心修复：强制隐藏遮罩层
    if (maskRef.current) {
      maskRef.current.style.opacity = '0'       // 渐变隐藏
      maskRef.current.style.pointerEvents = 'none' // 禁止拦截点击
      maskRef.current.style.display = 'none'    // 彻底隐藏
    }
    setTimeout(() => onClose?.(), 300)
  }

  return (
    <>
      {/* 遮罩：添加ref引用 + 过渡动画，确保关闭时平滑消失 */}
      <div 
        ref={maskRef}
        onClick={handleClose} 
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
          opacity: show ? 1 : 0, // 同步弹窗显隐
          transition: 'opacity 0.25s', // 过渡动画
          pointerEvents: show ? 'auto' : 'none' // 隐藏时不拦截点击
        }} 
      />

      {/* 弹窗 */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: `translate(-50%,-50%) scale(${show ? 1 : 0.85})`,
        zIndex: 201, width: '90%', maxWidth: '420px',
        background: 'white', borderRadius: '24px', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        opacity: show ? 1 : 0, transition: 'all 0.25s'
      }}>
        {/* 头部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>✏️ 修改账目</span>
          <button onClick={handleClose} style={{
            width: '30px', height: '30px', borderRadius: '50%', border: 'none',
            background: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <X size={14} color="#9ca3af" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* 收支切换 */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '12px', padding: '4px', gap: '4px' }}>
            {(['expense', 'income'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)} style={{
                flex: 1, padding: '8px 0', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                background: type === t ? 'white' : 'transparent',
                color: type === t ? (t === 'expense' ? '#ef4444' : '#16a34a') : '#9ca3af'
              }}>
                {t === 'expense' ? '💸 支出' : '💰 收入'}
              </button>
            ))}
          </div>

          {/* 金额 */}
          <div style={{ borderRadius: '16px', padding: '16px 20px', background: type === 'expense' ? '#fff1f2' : '#f0fdf4' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>金额（元）</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: type === 'expense' ? '#ef4444' : '#16a34a' }}>¥</span>
              <input type="number" step="0.01" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.00"
                style={{ flex: 1, fontSize: '28px', fontWeight: 800, background: 'transparent', border: 'none', outline: 'none', color: '#1f2937', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* 日期 */}
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>日期</p>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
              padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #e5e7eb',
              fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', color: '#1f2937'
            }}/>
          </div>

          {/* 分类 */}
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>分类</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {catTree.map(item => (
                <button key={item.name} type="button" onClick={() => handleCatTap(item)} style={{
                  padding: '8px 12px', borderRadius: '99px', border: `2px solid ${category === item.name ? '#6366f1' : '#f3f4f6'}`,
                  background: category === item.name ? '#6366f1' : '#f9fafb',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: category === item.name ? 'white' : '#374151',
                  transition: 'all 0.15s'
                }}>
                  {item.icon} {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <ImeInput
            value={note} onChange={setNote}
            placeholder="✏️ 备注（可选）"
            style={{ padding: '10px 14px', background: '#f9fafb', border: '1.5px solid #f3f4f6', borderRadius: '14px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' } as React.CSSProperties}
          />

          {/* 支付方式 */}
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 600 }}>支付方式</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map(pm => {
                const sel = paymentMethod === pm.id
                return (
                  <button key={pm.id} type="button" onClick={() => setPaymentMethod(pm.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '99px', border: '2px solid',
                    borderColor: sel ? pm.color : '#e5e7eb',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    background: sel ? pm.color : 'white',
                    color: sel ? 'white' : '#374151', transition: 'all 0.15s'
                  }}>
                    <span>{pm.icon}</span><span>{pm.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 提交 */}
          <button type="submit" disabled={isLoading || !amount || !category} style={{
            padding: '12px 0', borderRadius: '14px', border: 'none',
            background: (!amount || !category) ? '#d1d5db' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: 'white', fontSize: '15px', fontWeight: 700, cursor: (!amount || !category) ? 'not-allowed' : 'pointer'
          }}>
            {isLoading ? '保存中...' : '✓ 保存修改'}
          </button>
        </form>
      </div>
    </>
  )
}