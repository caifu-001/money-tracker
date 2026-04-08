import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Shield, RefreshCw, Bell } from 'lucide-react'
import { UserManagement } from './UserManagement'

export function Admin() {
  const { user } = useAppStore()
  const [stats, setStats] = useState({ total: 0, active: 0, admin: 0, pending: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [newUserAlert, setNewUserAlert] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== 'admin') return
    loadStats()

    // 订阅新用户注册（实时通知）
    const subscription = supabase
      .channel('new-users')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, (payload) => {
        const newUser = payload.new as any
        if (newUser.status === 'pending') {
          setNewUserAlert(`新用户 "${newUser.name || newUser.email}" 等待审核`)
          // 3秒后自动隐藏
          setTimeout(() => setNewUserAlert(null), 5000)
          // 刷新统计
          loadStats()
        }
      })
      .subscribe()

    return () => { subscription.unsubscribe() }
  }, [user])

  const loadStats = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('users').select('*')
    if (data) setStats({
      total: data.length,
      active: data.filter(u => u.status === 'active').length,
      admin: data.filter(u => u.role === 'admin').length,
      pending: data.filter(u => u.status === 'pending').length,
    })
    setIsLoading(false)
  }

  // 从 Supabase Auth 同步用户到 users 表
  const handleSyncUsers = async () => {
    setSyncing(true)
    try {
      // 获取当前 users 表所有 id
      const { data: existingUsers } = await supabase.from('users').select('id, email')
      const existingIds = new Set(existingUsers?.map(u => u.id) || [])

      // 通过 auth.users 视图查询（需要 service_role，普通 anon 可能无权限）
      // 替代方案：让用户登录时自动补全 users 表记录
      // 这里我们改为：查询 auth.users 中存在但 users 表中不存在的
      const { data: authData, error } = await supabase.rpc('get_auth_users_not_in_users_table')

      if (error) {
        // RPC 不存在时，提示手动处理
        alert('自动同步需要数据库函数支持。\n\n请让用户重新登录一次，系统会自动补全用户信息。')
        return
      }

      if (authData && authData.length > 0) {
        for (const u of authData) {
          if (!existingIds.has(u.id)) {
            await supabase.from('users').insert([{
              id: u.id,
              email: u.email,
              name: u.raw_user_meta_data?.name || u.email?.split('@')[0] || '未知用户',
              role: 'user',
              status: 'active'
            }])
          }
        }
        await loadStats()
        alert(`同步完成，新增 ${authData.length} 个用户`)
      } else {
        alert('所有用户已同步，无需更新')
      }
    } catch (e: any) {
      alert('同步失败：' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  if (user?.role !== 'admin') return (
    <div style={{ textAlign: 'center', padding: '60px 16px', color: '#9ca3af' }}>
      <Shield size={48} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
      <p>您没有管理员权限</p>
    </div>
  )

  const statCards = [
    { label: '总用户', value: stats.total, color: '#6366f1', bg: '#eef2ff' },
    { label: '已激活', value: stats.active, color: '#16a34a', bg: '#f0fdf4' },
    { label: '管理员', value: stats.admin, color: '#9333ea', bg: '#f3e8ff' },
    { label: '待审核', value: stats.pending, color: '#ca8a04', bg: '#fefce8' },
  ]

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* 新用户提示 */}
      {newUserAlert && (
        <div style={{
          position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)',
          maxWidth: '440px', width: '90%', zIndex: 100,
          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
          color: 'white', padding: '14px 20px', borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(249,115,22,0.35)',
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <style>{`@keyframes slideDown { from { transform: translate(-50%, -100%); opacity: 0 } to { transform: translate(-50%, 0); opacity: 1 } }`}</style>
          <Bell size={20} />
          <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>{newUserAlert}</span>
          <button onClick={() => setNewUserAlert(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>
      )}

      {/* 统计卡片 */}
      {!isLoading && (
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {statCards.map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: '14px', padding: '14px' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{s.label}</p>
                <p style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* 同步按钮 */}
          <button onClick={handleSyncUsers} disabled={syncing} style={{
            width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
            background: '#f3f4f6', color: '#6b7280', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            marginBottom: '4px'
          }}>
            <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? '同步中...' : '同步用户数据'}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      <div style={{ height: '8px' }} />
      <UserManagement />
    </div>
  )
}
