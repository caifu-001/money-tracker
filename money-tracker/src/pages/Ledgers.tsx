import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Plus } from 'lucide-react'

export function Ledgers() {
  const { user, currentLedger, setCurrentLedger } = useAppStore()
  const [ledgers, setLedgers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newLedgerName, setNewLedgerName] = useState('')
  const [newLedgerType, setNewLedgerType] = useState<'personal' | 'family' | 'project'>('personal')

  useEffect(() => {
    if (!user) return

    const loadLedgers = async () => {
      setIsLoading(true)
      try {
        let query = supabase
          .from('ledgers')
          .select('*')
          .order('created_at', { ascending: false })

        // 如果是普通用户，只查询自己的账本
        // 如果是管理员，查询所有账本
        if (user.role !== 'admin') {
          query = query.eq('owner_id', user.id)
        }

        const { data } = await query
        setLedgers(data || [])
      } catch (error) {
        console.error('加载账本失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLedgers()
  }, [user])

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newLedgerName) {
      alert('请输入账本名称')
      return
    }

    try {
      const { data, error } = await supabase
        .from('ledgers')
        .insert([{
          name: newLedgerName,
          type: newLedgerType,
          owner_id: user.id
        }])
        .select()

      if (error) {
        alert(`创建失败: ${error.message}`)
        return
      }

      if (data && data[0]) {
        setLedgers([data[0], ...ledgers])
        setCurrentLedger(data[0])
        setNewLedgerName('')
        setShowCreateForm(false)
        alert('账本创建成功！')
      }
    } catch (error: any) {
      alert(`创建失败: ${error.message}`)
    }
  }

  const typeLabels = {
    personal: '个人账本',
    family: '家庭账本',
    project: '项目账本'
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📚 {user?.role === 'admin' ? '所有账本' : '我的账本'}</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* 创建账本表单 */}
      {showCreateForm && (
        <form onSubmit={handleCreateLedger} className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">账本名称</label>
              <input
                type="text"
                value={newLedgerName}
                onChange={(e) => setNewLedgerName(e.target.value)}
                placeholder="例如：2026年家庭账本"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">账本类型</label>
              <select
                value={newLedgerType}
                onChange={(e) => setNewLedgerType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="personal">个人账本</option>
                <option value="family">家庭账本</option>
                <option value="project">项目账本</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
              >
                创建账本
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : ledgers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">暂无账本</div>
      ) : (
        <div className="space-y-3">
          {ledgers.map((ledger) => (
            <div
              key={ledger.id}
              onClick={() => setCurrentLedger(ledger)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                currentLedger?.id === ledger.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{ledger.name}</h3>
                  <p className="text-sm text-gray-500">{typeLabels[ledger.type as keyof typeof typeLabels]}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    创建于 {new Date(ledger.created_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                {currentLedger?.id === ledger.id && (
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    当前
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
