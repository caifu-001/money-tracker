import { useState } from 'react'
import { X } from 'lucide-react'
import { transactionService } from '../lib/services'
import { useAppStore } from '../store/appStore'
import { DEFAULT_CATEGORIES } from '../lib/categories'

interface QuickAddProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function QuickAdd({ isOpen, onClose, onSuccess }: QuickAddProps) {
  const { currentLedger, user } = useAppStore()
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const categories = DEFAULT_CATEGORIES[type]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentLedger || !user || !amount || !category) {
      alert('请填写金额并选择分类')
      return
    }

    setIsLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { error } = await transactionService.addTransaction(
        currentLedger.id,
        user.id,
        parseFloat(amount),
        type,
        category,
        note,
        today
      )

      if (error) {
        alert(`记账失败: ${error.message || '未知错误'}`)
        return
      }

      onSuccess()
      setAmount('')
      setCategory('')
      setNote('')
      onClose()
    } catch (error: any) {
      alert(`记账失败: ${error.message || '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 面板 */}
      <div className="relative bg-white w-full rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* 拖拽指示条 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8">
          {/* 标题 */}
          <div className="flex justify-between items-center py-4">
            <h2 className="text-lg font-bold text-gray-800">记一笔</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 收支切换 */}
            <div className="flex bg-gray-100 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => { setType('expense'); setCategory('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  type === 'expense'
                    ? 'bg-white text-red-500 shadow-sm'
                    : 'text-gray-400'
                }`}
              >
                💸 支出
              </button>
              <button
                type="button"
                onClick={() => { setType('income'); setCategory('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  type === 'income'
                    ? 'bg-white text-green-500 shadow-sm'
                    : 'text-gray-400'
                }`}
              >
                💰 收入
              </button>
            </div>

            {/* 金额输入 */}
            <div className={`rounded-2xl p-4 ${
              type === 'expense' ? 'bg-red-50' : 'bg-green-50'
            }`}>
              <p className="text-xs text-gray-400 mb-1">金额（元）</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${
                  type === 'expense' ? 'text-red-400' : 'text-green-400'
                }`}>¥</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-3xl font-bold text-gray-800 focus:outline-none placeholder-gray-300"
                  autoFocus
                />
              </div>
            </div>

            {/* 分类选择 */}
            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">选择分类</p>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`p-3 rounded-2xl text-center transition-all active:scale-95 ${
                      category === cat.name
                        ? type === 'expense'
                          ? 'bg-red-500 text-white shadow-md shadow-red-200'
                          : 'bg-green-500 text-white shadow-md shadow-green-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <p className="text-2xl mb-1">{cat.icon}</p>
                    <p className={`text-xs font-medium ${
                      category === cat.name ? 'text-white' : 'text-gray-600'
                    }`}>{cat.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 备注 */}
            <div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="✏️ 添加备注（可选）"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
              />
            </div>

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading || !amount || !category}
              className={`w-full py-4 rounded-2xl font-bold text-white text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg ${
                type === 'expense'
                  ? 'bg-gradient-to-r from-red-400 to-pink-500 shadow-red-200'
                  : 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-green-200'
              }`}
            >
              {isLoading ? '记账中...' : '✓ 确认记账'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
