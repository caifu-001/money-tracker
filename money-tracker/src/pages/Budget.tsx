import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { transactionService, budgetService } from '../lib/services'
import { supabase } from '../lib/supabase'
import { Plus } from 'lucide-react'

export function Budget() {
  const { currentLedger } = useAppStore()
  const [monthlyBudget, setMonthlyBudget] = useState<any>(null)
  const [totalSpent, setTotalSpent] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [formAmount, setFormAmount] = useState('')

  useEffect(() => {
    if (!currentLedger) return

    const loadBudgetData = async () => {
      setIsLoading(true)
      try {
        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()

        // 获取整体预算（使用特殊的 "总预算" 类别）
        const { data: budgetData } = await supabase
          .from('budgets')
          .select('*')
          .eq('ledger_id', currentLedger.id)
          .eq('category', '总预算')
          .eq('month', month)
          .eq('year', year)
          .single()

        if (budgetData) {
          setMonthlyBudget(budgetData)
          setFormAmount(budgetData.amount.toString())
        }

        // 获取本月支出
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDate = now.toISOString().split('T')[0]
        const { data: transactions } = await transactionService.getTransactions(
          currentLedger.id,
          startDate,
          endDate
        )

        const spent = transactions
          ?.filter((t: any) => t.type === 'expense')
          .reduce((sum: number, t: any) => sum + t.amount, 0) || 0
        setTotalSpent(spent)
      } catch (error) {
        console.error('加载预算数据失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadBudgetData()
  }, [currentLedger])

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentLedger || !formAmount) {
      alert('请输入预算金额')
      return
    }

    try {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()

      const { error } = await budgetService.setBudget(
        currentLedger.id,
        '总预算',
        parseFloat(formAmount),
        month,
        year
      )

      if (error) {
        alert(`设置失败: ${error.message || '未知错误'}`)
        return
      }

      // 重新加载
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('ledger_id', currentLedger.id)
        .eq('category', '总预算')
        .eq('month', month)
        .eq('year', year)
        .single()

      if (budgetData) {
        setMonthlyBudget(budgetData)
      }

      setShowEditForm(false)
      alert('预算设置成功！')
    } catch (error: any) {
      alert(`设置失败: ${error.message || '未知错误'}`)
    }
  }

  const handleDeleteBudget = async () => {
    if (!confirm('确定删除本月预算吗？')) return

    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', monthlyBudget.id)

      if (error) {
        alert(`删除失败: ${error.message || '未知错误'}`)
        return
      }

      setMonthlyBudget(null)
      setFormAmount('')
      alert('预算已删除')
    } catch (error: any) {
      alert(`删除失败: ${error.message || '未知错误'}`)
    }
  }

  if (!currentLedger) {
    return <div className="p-4 text-center text-gray-500">请先选择账本</div>
  }

  const budget = monthlyBudget?.amount || 0
  const remaining = budget - totalSpent
  const percentage = budget > 0 ? (totalSpent / budget) * 100 : 0

  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">💰 预算管理</h1>

      {/* 编辑预算表单 */}
      {showEditForm && (
        <form onSubmit={handleSetBudget} className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">本月预算金额</label>
              <input
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="输入本月预算金额"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600"
              >
                保存预算
              </button>
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        <>
          {/* 预算卡片 */}
          {monthlyBudget ? (
            <div className="space-y-6">
              {/* 预算总览 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-gray-600 mb-1">本月预算</p>
                  <p className="text-2xl font-bold text-blue-600">¥{budget.toFixed(2)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-xs text-gray-600 mb-1">已支出</p>
                  <p className="text-2xl font-bold text-red-600">¥{totalSpent.toFixed(2)}</p>
                </div>
                <div className={`p-4 rounded-lg border-2 ${
                  remaining >= 0
                    ? 'bg-green-50 border-green-200'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <p className="text-xs text-gray-600 mb-1">剩余</p>
                  <p className={`text-2xl font-bold ${
                    remaining >= 0 ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    ¥{remaining.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* 进度条 */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <p className="font-semibold">预算使用进度</p>
                  <p className={`text-sm font-bold ${
                    percentage > 100 ? 'text-red-600' : percentage > 80 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {percentage.toFixed(1)}%
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      percentage > 100 ? 'bg-red-500' : percentage > 80 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                {percentage > 100 && (
                  <p className="text-xs text-red-600 mt-2">⚠️ 已超出预算 ¥{(totalSpent - budget).toFixed(2)}</p>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditForm(true)}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
                >
                  修改预算
                </button>
                <button
                  onClick={handleDeleteBudget}
                  className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition"
                >
                  删除预算
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-6">暂无本月预算</p>
              <button
                onClick={() => setShowEditForm(true)}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition inline-flex items-center gap-2"
              >
                <Plus size={20} /> 设置本月预算
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
