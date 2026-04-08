import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'

export function UserManagement() {
  const { user } = useAppStore()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'users' | 'ledger'>('users')
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetUserId, setResetUserId] = useState('')
  const [resetUserName, setResetUserName] = useState('')
  const [newPassword, setNewPassword] = useState('')

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  React.useEffect(() => { loadUsers() }, [])

  async function handleApprove(id: string, role: string = 'user') {
    await supabase.from('users').update({ status: 'active', role }).eq('id', id)
    loadUsers()
  }

  async function handleDisable(id: string) {
    if (!confirm('确定禁用该用户？禁用后该账号无法登录。')) return
    await supabase.from('users').update({ status: 'disabled' }).eq('id', id)
    loadUsers()
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该用户？（Auth账号需在Supabase后台手动清理，否则该邮箱无法重新注册）')) return
    await supabase.from('users').delete().eq('id', id)
    loadUsers()
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetUserId || !newPassword || newPassword.length < 6) {
      alert('密码长度至少6位')
      return
    }
    // 调用 Edge Function
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token || ''
    const res = await fetch(
      'https://abkscyijuvkfeazhlquz.supabase.co/functions/v1/admin-reset-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ target_user_id: resetUserId, new_password: newPassword }),
      }
    )
    const result = await res.json()
    if (!res.ok || result.error) {
      alert(`重置失败：${result.error || '未知错误'}`)
    } else {
      alert('✅ 密码重置成功！')
      setShowResetForm(false)
      setNewPassword('')
      setResetUserId('')
      setResetUserName('')
    }
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* 顶部标题 */}
      <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', padding: '24px 20px 20px', marginBottom: '20px' }}>
        <p style={{ fontSize: '22px', fontWeight: 700, color: 'white', margin: 0 }}>👥 用户管理</p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>管理所有注册用户账号</p>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 20px', marginBottom: '16px' }}>
        {(['users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            background: tab === t ? '#6366f1' : '#f3f4f6',
            color: tab === t ? 'white' : '#6b7280',
          }}>全部用户</button>
        ))}
      </div>

      {/* 用户列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>加载中...</div>
      ) : (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {users.map(u => (
            <div key={u.id} style={{
              background: 'white', borderRadius: '16px', padding: '16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: u.role === 'admin' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 700, color: u.role === 'admin' ? 'white' : '#6b7280',
                  flexShrink: 0
                }}>
                  {u.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: '#1f2937', fontSize: '15px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.name || '未设置昵称'}
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>{u.email}</p>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600,
                    background: u.status === 'active' ? '#dcfce7' : u.status === 'pending' ? '#fef9c3' : '#fee2e2',
                    color: u.status === 'active' ? '#16a34a' : u.status === 'pending' ? '#ca8a04' : '#dc2626',
                  }}>
                    {u.status === 'active' ? '已激活' : u.status === 'pending' ? '待审核' : '已禁用'}
                  </span>
                  <span style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600,
                    background: u.role === 'admin' ? '#ede9fe' : '#f3f4f6',
                    color: u.role === 'admin' ? '#7c3aed' : '#6b7280',
                  }}>
                    {u.role === 'admin' ? '管理员' : '普通用户'}
                  </span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {u.status === 'pending' && (
                  <>
                    <button onClick={() => handleApprove(u.id, 'user')} style={{ padding: '6px 14px', borderRadius: '12px', border: 'none', background: '#dcfce7', color: '#16a34a', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>✅ 通过（用户）</button>
                    <button onClick={() => handleApprove(u.id, 'admin')} style={{ padding: '6px 14px', borderRadius: '12px', border: 'none', background: '#ede9fe', color: '#7c3aed', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>🛡️ 通过（管理员）</button>
                  </>
                )}
                {u.status === 'active' && (
                  <>
                    <button onClick={() => { setResetUserId(u.id); setResetUserName(u.name || u.email); setShowResetForm(true); setNewPassword('') }} style={{ padding: '6px 14px', borderRadius: '12px', border: 'none', background: '#eef2ff', color: '#6366f1', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>🔑 重置密码</button>
                    <button onClick={() => handleDisable(u.id)} style={{ padding: '6px 14px', borderRadius: '12px', border: 'none', background: '#fef9c3', color: '#ca8a04', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>🚫 禁用</button>
                  </>
                )}
                {u.status === 'disabled' && (
                  <button onClick={() => handleApprove(u.id, u.role || 'user')} style={{ padding: '6px 14px', borderRadius: '12px', border: 'none', background: '#dcfce7', color: '#16a34a', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>✅ 启用</button>
                )}
                {u.id !== user?.id && (
                  <button onClick={() => handleDelete(u.id)} style={{ padding: '6px 14px', borderRadius: '12px', border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>🗑 删除</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 重置密码弹窗 */}
      {showResetForm && (
        <>
          <div onClick={() => setShowResetForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 301,
            background: 'white', borderRadius: '20px', padding: '24px', width: '90%', maxWidth: '380px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '17px', color: '#1f2937' }}>🔑 重置密码</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              为「{resetUserName}」设置新密码（至少6位）
            </p>
            <form onSubmit={handleResetPassword}>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="输入新密码（至少6位）" minLength={6}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowResetForm(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>取消</button>
                <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>确认重置</button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
