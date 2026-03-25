import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Trash2, Users, ArrowUpCircle, ArrowDownCircle, TrendingUp } from 'lucide-react'

export function Home() {
  const { currentLedger, user, transactions, setTransactions } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [ledgerUsers, setLedgerUsers] = useState<any[]>([])
  const [showUserFilter, setShowUserFilter] = useState(false)

  useEffect(() => {
    if (!currentLedger) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        if (user?.role === 'admin') {
          const { data: members } = await supabase
            .from('ledger_members')
            .select('user_id, users(id, email, name)')
            .eq('ledger_id', currentLedger.id)

          if (members) {
            const users = members.map((m: any) => m.users).filter(Boolean)
            setLedgerUsers(users)
            if (users.length > 0 && !selectedUserId) {
              setSelectedUserId(users[0].id)
            }
          }
        }

        const today = new Date()
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const startDate = startOfMonth.toISOString().split('T')[0]
        const endDate = today.toISOString().split('T')[0]

        let query = supabase
          .from('transactions')
          .select('*')
          .eq('ledger_id', currentLedger.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false })

        if (user?.role !== 'admin') {
          query = query.eq('user_id', user?.id)
        } else if (selectedUserId) {
          query = query.eq('user_id', selectedUserId)
        }

        const { data } = await query
        setTransactions(data || [])
      } catch (error) {
        console.error('加载账目失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [currentLedger, user, selectedUserId, setTransactions])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条账目吗？')) return
    try {
      await supabase.from('transactions').delete().eq('id', id)
      setTransactions(transactions.filter(t => t.id !== id))
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = totalIncome - totalExpense

  const currentViewUser = selectedUserId
    ? ledgerUsers.find(u => u.id === selectedUserId)
    : user

  if (!currentLedger) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <div className="text-6xl mb-4">📚</div>
        <p className="text-gray-500 text-lg font-medium">还没有账本</p>
        <p className="text-gray-400 text-sm mt-1">请先在「账本」页面创建一个账本</p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* 顶部统计卡片 */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-5 pt-6 pb-10 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex justify-between items-start mb-5">
            <div>
              <p className="text-white text-opacity-80 text-sm">📖 {currentLedger.name}</p>
              <p className="text-white text-opacity-60 text-xs mt-0.5">
                {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
              </p>
            </div>
            {user?.role === 'admin' && ledgerUsers.length > 1 && (
              <button
                onClick={() => setShowUserFilter(!showUserFilter)}
                className="flex items-center gap-1 bg-white bg-opacity-20 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm hover:bg-opacity-30 transition"
              >
                <Users size={14} />
                {currentViewUser?.name || currentViewUser?.email || '全部'}
              </button>
            )}
          </div>

          {/* 用户过滤器 */}
          {showUserFilter && user?.role === 'admin' && (
            <div className="mb-4 bg-white bg-opacity-15 backdrop-blur-sm p-3 rounded-2xl">
              <p className="text-white text-opacity-80 text-xs mb-2">选择用户：</p>
              <div className="flex flex-wrap gap-2">
                {ledgerUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUserId(u.id); setShowUserFilter(false) }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      selectedUserId === u.id
                        ? 'bg-white text-indigo-600'
                        : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                    }`}
                  >
                    {u.name || u.email}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 结余 */}
          <div className="text-center mb-5">
            <p className="text-white text-opacity-70 text-sm mb-1">本月结余</p>
            <p className="text-white text-4xl font-bold tracking-tight">
              ¥{balance.toFixed(2)}
            </p>
          </div>

          {/* 收支卡片 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle size={16} className="text-green-300" />
                <span className="text-white text-opacity-80 text-xs">收入</span>
              </div>
              <p className="text-white text-xl font-bold">¥{totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle size={16} className="text-red-300" />
                <span className="text-white text-opacity-80 text-xs">支出</span>
              </div>
              <p className="text-white text-xl font-bold">¥{totalExpense.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 账目列表 */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">本月账目</h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
              共 {transactions.length} 条
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-400 font-medium">本月暂无账目</p>
              <p className="text-gray-300 text-sm mt-1">点击右下角按钮开始记账</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center px-5 py-4 hover:bg-gray-50 transition group"
                >
                  {/* 类别图标 */}
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg mr-3 flex-shrink-0 ${
                    transaction.type === 'income'
                      ? 'bg-green-50'
                      : 'bg-red-50'
                  }`}>
                    {transaction.category.split(' ')[0] || (transaction.type === 'income' ? '💰' : '💸')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{transaction.category}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(transaction.date), 'MM月dd日 EEE', { locale: zhCN })}
                      {transaction.note && ` · ${transaction.note}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    <span className={`text-base font-bold ${
                      transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toFixed(2)}
                    </span>
                    {(user?.role === 'admin' || transaction.user_id === user?.id) && (
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="p-1.5 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
