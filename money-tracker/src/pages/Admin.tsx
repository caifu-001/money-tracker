import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Shield } from 'lucide-react'
import { UserManagement } from './UserManagement'

export function Admin() {
  const { user } = useAppStore()
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    pendingUsers: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user?.role !== 'admin') return
    loadStats()
  }, [user])

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from('users')
        .select('*')

      if (data) {
        setStats({
          totalUsers: data.length,
          activeUsers: data.filter(u => u.status === 'active').length,
          adminUsers: data.filter(u => u.role === 'admin').length,
          pendingUsers: data.filter(u => u.status === 'pending').length
        })
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="p-4 text-center text-gray-500">
        <Shield size={48} className="mx-auto mb-4 opacity-50" />
        <p>您没有管理员权限</p>
      </div>
    )
  }

  return (
    <div className="pb-20">
      {/* 统计卡片 */}
      {!isLoading && (
        <div className="p-4 grid grid-cols-2 gap-3 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600">总用户数</p>
            <p className="text-2xl font-bold text-blue-600">{stats.totalUsers}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-xs text-gray-600">已激活</p>
            <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-xs text-gray-600">管理员</p>
            <p className="text-2xl font-bold text-purple-600">{stats.adminUsers}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <p className="text-xs text-gray-600">待审核</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingUsers}</p>
          </div>
        </div>
      )}

      {/* 用户管理 */}
      <UserManagement />
    </div>
  )
}
