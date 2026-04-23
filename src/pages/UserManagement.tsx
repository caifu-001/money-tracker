import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Shield, Check, X, RotateCcw, Trash2 } from 'lucide-react'

function getActivityInfo(lastLogin: string | null) {
  if (!lastLogin) return { label: '从未登录', cls: 'zombie', days: Infinity }
  const diff = (Date.now() - new Date(lastLogin).getTime()) / 86400000
  if (diff <= 7)  return { label: '活跃', cls: 'online', days: diff }
  if (diff <= 30) return { label: '偶尔', cls: 'active', days: diff }
  if (diff <= 90) return { label: '一般', cls: 'normal', days: diff }
  if (diff <= 180) return { label: '不活跃', cls: 'inactive', days: diff }
  return { label: '僵尸', cls: 'zombie', days: diff }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

export function UserManagement() {
  const { user } = useAppStore()
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (user?.role !== 'admin') return
    loadUsers()
  }, [user])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
      setUsers(data || [])
    } catch (error) {
      console.error('加载用户列表失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)

      if (error) {
        alert(`审核失败: ${error.message}`)
        return
      }

      setUsers(users.map(u => u.id === userId ? { ...u, status: 'active' } : u))
      alert('用户已批准')
    } catch (error: any) {
      alert(`审核失败: ${error.message}`)
    }
  }

  const handleRejectUser = async (userId: string) => {
    if (!confirm('确定拒绝这个用户吗？')) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) {
        alert(`拒绝失败: ${error.message}`)
        return
      }

      setUsers(users.filter(u => u.id !== userId))
      alert('用户已拒绝')
    } catch (error: any) {
      alert(`拒绝失败: ${error.message}`)
    }
  }

  const handleSetAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: isAdmin ? 'admin' : 'user' })
        .eq('id', userId)

      if (error) {
        alert(`设置失败: ${error.message}`)
        return
      }

      setUsers(users.map(u => u.id === userId ? { ...u, role: isAdmin ? 'admin' : 'user' } : u))
      alert(isAdmin ? '已设置为管理员' : '已设置为普通用户')
    } catch (error: any) {
      alert(`设置失败: ${error.message}`)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetUserId || !newPassword) {
      alert('请输入新密码')
      return
    }

    try {
      const { error } = await supabase.auth.admin.updateUserById(resetUserId, {
        password: newPassword
      })

      if (error) {
        alert(`重置失败: ${error.message}`)
        return
      }

      setShowResetForm(false)
      setResetUserId(null)
      setNewPassword('')
      alert('密码已重置')
    } catch (error: any) {
      alert(`重置失败: ${error.message}`)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定删除这个用户吗？')) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) {
        alert(`删除失败: ${error.message}`)
        return
      }

      setUsers(users.filter(u => u.id !== userId))
      alert('用户已删除')
    } catch (error: any) {
      alert(`删除失败: ${error.message}`)
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
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">👥 用户管理</h1>

      {/* 重置密码表单 */}
      {showResetForm && resetUserId && (
        <form onSubmit={handleResetPassword} className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
              >
                重置密码
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetForm(false)
                  setResetUserId(null)
                  setNewPassword('')
                }}
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
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-gray-500">暂无用户</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-lg">{u.name || u.email}</p>
                  <p className="text-sm text-gray-500">{u.email}</p>
          <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500">
                      注册：{fmtDate(u.created_at)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      u.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {u.status === 'active' ? '已激活' : '待审核'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                    {(() => {
                      const act = getActivityInfo(u.last_login)
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                          act.cls === 'online' ? 'bg-green-100 text-green-700' :
                          act.cls === 'active' ? 'bg-blue-100 text-blue-700' :
                          act.cls === 'normal' ? 'bg-yellow-100 text-yellow-700' :
                          act.cls === 'inactive' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {act.label}
                        </span>
                      )
                    })()}
                    <span className="text-xs text-gray-400">
                      登录：{fmtDate(u.last_login)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-wrap gap-2">
                {/* 审核按钮 */}
                {u.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApproveUser(u.id)}
                      className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition"
                    >
                      <Check size={16} /> 批准
                    </button>
                    <button
                      onClick={() => handleRejectUser(u.id)}
                      className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
                    >
                      <X size={16} /> 拒绝
                    </button>
                  </>
                )}

                {/* 角色切换 */}
                {u.status === 'active' && u.id !== user?.id && (
                  <button
                    onClick={() => handleSetAdmin(u.id, u.role !== 'admin')}
                    className={`flex items-center gap-1 px-3 py-1 rounded text-sm transition ${
                      u.role === 'admin'
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    }`}
                  >
                    <Shield size={16} /> {u.role === 'admin' ? '取消管理员' : '设为管理员'}
                  </button>
                )}

                {/* 重置密码 */}
                {u.status === 'active' && (
                  <button
                    onClick={() => {
                      setResetUserId(u.id)
                      setShowResetForm(true)
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition"
                  >
                    <RotateCcw size={16} /> 重置密码
                  </button>
                )}

                {/* 删除用户 */}
                {u.id !== user?.id && (
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                  >
                    <Trash2 size={16} /> 删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
