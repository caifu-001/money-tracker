import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Users, Copy, Check, UserPlus, Trash2, ChevronDown } from 'lucide-react'

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  owner:  { label: '👑 所有者', color: '#f59e0b', bg: '#fffbeb' },
  editor: { label: '✏️ 编辑者', color: '#6366f1', bg: '#eef2ff' },
  viewer: { label: '👁 查看者', color: '#16a34a', bg: '#dcfce7' },
}

export function FamilyLedger() {
  const { currentLedger, user, setCurrentLedger } = useAppStore()
  const [members, setMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinResult, setJoinResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [myLedgers, setMyLedgers] = useState<any[]>([])
  const [showLedgerPicker, setShowLedgerPicker] = useState(false)

  // 邀请码 = 账本 ID 前8位大写
  const inviteCode = currentLedger?.id?.replace(/-/g, '').substring(0, 8).toUpperCase() || ''
  const inviteLink = `https://caifu-001.github.io/money-tracker/?join=${inviteCode}`

  const loadMembers = async () => {
    if (!currentLedger) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('ledger_members')
        .select('id, role, user_id, users(id, name, email)')
        .eq('ledger_id', currentLedger.id)
      if (error) throw error
      setMembers(data || [])
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  const loadMyLedgers = async () => {
    if (!user) return
    const { data } = await supabase.from('ledgers').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
    setMyLedgers(data || [])
  }

  useEffect(() => {
    loadMembers()
    loadMyLedgers()
  }, [currentLedger, user])

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = inviteLink
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) { setJoinResult({ ok: false, msg: '请先登录' }); return }
    const code = joinCode.trim().toUpperCase().replace(/-/g, '')
    if (!code || code.length < 6) { setJoinResult({ ok: false, msg: '邀请码格式不正确（至少6位）' }); return }
    setJoining(true); setJoinResult(null)
    try {
      // 查找匹配的账本（ID 去掉横线后前N位匹配）
      const { data: allLedgers } = await supabase.from('ledgers').select('*')
      const matched = (allLedgers || []).find((l: any) => {
        const lid = l.id.replace(/-/g, '').toUpperCase()
        return lid.startsWith(code) || code.startsWith(lid.substring(0, 8))
      })
      if (!matched) { setJoinResult({ ok: false, msg: '邀请码无效，请确认后重试' }); setJoining(false); return }

      // 检查是否已是成员
      const { data: existing } = await supabase.from('ledger_members').select('id')
        .eq('ledger_id', matched.id).eq('user_id', user.id)
      if (existing && existing.length > 0) {
        setJoinResult({ ok: false, msg: `你已经是「${matched.name}」的成员了` })
        setJoining(false); return
      }

      // 加入账本
      const { error } = await supabase.from('ledger_members').insert([{
        ledger_id: matched.id, user_id: user.id, role: 'editor'
      }])
      if (error) throw error

      setJoinResult({ ok: true, msg: `✅ 成功加入「${matched.name}」！` })
      setJoinCode('')
      // 自动切换到该账本
      setCurrentLedger(matched)
      loadMembers()
    } catch (err: any) {
      setJoinResult({ ok: false, msg: `加入失败：${err.message}` })
    } finally { setJoining(false) }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`确定移除「${memberName}」？`)) return
    await supabase.from('ledger_members').delete().eq('id', memberId)
    loadMembers()
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    await supabase.from('ledger_members').update({ role: newRole }).eq('id', memberId)
    loadMembers()
  }

  const handleLeave = async () => {
    if (!confirm('确定退出该账本？')) return
    const myMember = members.find((m: any) => m.users?.id === user?.id)
    if (myMember) {
      await supabase.from('ledger_members').delete().eq('id', myMember.id)
      setMembers(prev => prev.filter(m => m.id !== myMember.id))
    }
  }

  const amIOwner = members.some(m => m.users?.id === user?.id && m.role === 'owner')
    || currentLedger?.owner_id === user?.id

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '16px 16px 100px' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937' }}>👨‍👩‍👧 家庭协同</h1>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>邀请家人一起记账，共享账目数据</p>
      </div>

      {/* 账本选择器 */}
      {myLedgers.length > 1 && (
        <div style={{ background: 'white', borderRadius: 16, padding: '12px 16px', marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>选择要管理的账本</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {myLedgers.map(l => (
              <button key={l.id} onClick={() => setCurrentLedger(l)}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: currentLedger?.id === l.id ? '#6366f1' : '#f3f4f6',
                  color: currentLedger?.id === l.id ? 'white' : '#6b7280' }}>
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!currentLedger ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 20 }}>
          <p style={{ fontSize: 44, marginBottom: 12 }}>📒</p>
          <p style={{ color: '#9ca3af', fontWeight: 600, fontSize: 15 }}>请先选择账本</p>
        </div>
      ) : (
        <>
          {/* 邀请卡片 */}
          <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 20, padding: '20px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}/>
            <div style={{ position: 'relative' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6 }}>📖 {currentLedger.name}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 12 }}>邀请码（发给家人，让他们输入加入）</p>

              {/* 邀请码大字 */}
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'white', fontSize: 26, fontWeight: 900, letterSpacing: 6, fontFamily: 'monospace' }}>{inviteCode}</span>
                <button onClick={handleCopyCode}
                  style={{ background: copied ? '#22c55e' : 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {copied ? <Check size={14}/> : <Copy size={14}/>}
                  {copied ? '已复制！' : '复制链接'}
                </button>
              </div>

              {/* 加入按钮 */}
              <button onClick={() => setShowJoin(!showJoin)}
                style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <UserPlus size={16}/>
                {showJoin ? '收起' : '输入邀请码加入他人账本'}
              </button>
            </div>
          </div>

          {/* 加入表单 */}
          {showJoin && (
            <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginBottom: 6 }}>🔗 加入他人账本</p>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>输入对方分享给你的邀请码（8位字母数字）</p>
              <form onSubmit={handleJoin}>
                <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="例如：A1B2C3D4"
                  maxLength={8}
                  style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 18, fontWeight: 700, outline: 'none', marginBottom: 12, boxSizing: 'border-box', letterSpacing: 4, fontFamily: 'monospace', textAlign: 'center', textTransform: 'uppercase' }}/>
                {joinResult && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: joinResult.ok ? '#f0fdf4' : '#fef2f2', color: joinResult.ok ? '#16a34a' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
                    {joinResult.msg}
                  </div>
                )}
                <button type="submit" disabled={joining || joinCode.length < 6}
                  style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: joining || joinCode.length < 6 ? '#d1d5db' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: 14, cursor: joining || joinCode.length < 6 ? 'not-allowed' : 'pointer', boxShadow: joining || joinCode.length < 6 ? 'none' : '0 4px 14px rgba(99,102,241,0.3)' }}>
                  {joining ? '加入中...' : '✓ 确认加入'}
                </button>
              </form>
            </div>
          )}

          {/* 成员列表 */}
          <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>👥 账本成员</p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>共 {members.length} 人 · 所有成员可查看全部账目</p>
              </div>
              {!amIOwner && (
                <button onClick={handleLeave}
                  style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  退出账本
                </button>
              )}
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }}/>
              </div>
            ) : members.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: 36, marginBottom: 10 }}>👤</p>
                <p style={{ color: '#9ca3af', fontSize: 14 }}>暂无成员，分享邀请码邀请家人加入</p>
              </div>
            ) : (
              <div>
                {members.map((m: any) => {
                  const u = m.users
                  const isMe = u?.id === user?.id
                  const roleCfg = ROLE_CFG[m.role] || ROLE_CFG.viewer
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f9fafb' }}>
                      {/* 头像 */}
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: isMe ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: isMe ? 'white' : '#6b7280', marginRight: 12, flexShrink: 0 }}>
                        {u?.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>

                      {/* 信息 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{u?.name || '未知用户'}</p>
                          {isMe && <span style={{ fontSize: 10, background: '#eef2ff', color: '#6366f1', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>我</span>}
                        </div>
                        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{u?.email}</p>
                      </div>

                      {/* 角色 + 操作 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {m.role === 'owner' ? (
                          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 700, background: roleCfg.bg, color: roleCfg.color }}>{roleCfg.label}</span>
                        ) : amIOwner && !isMe ? (
                          // 所有者可修改角色
                          <select value={m.role} onChange={e => handleChangeRole(m.id, e.target.value)}
                            style={{ padding: '5px 10px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', background: roleCfg.bg, color: roleCfg.color }}>
                            <option value="editor">✏️ 编辑者</option>
                            <option value="viewer">👁 查看者</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 700, background: roleCfg.bg, color: roleCfg.color }}>{roleCfg.label}</span>
                        )}

                        {/* 移除按钮（所有者可移除非所有者成员） */}
                        {amIOwner && m.role !== 'owner' && !isMe && (
                          <button onClick={() => handleRemoveMember(m.id, u?.name || '该成员')}
                            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 说明 */}
          <div style={{ background: '#f0fdf4', borderRadius: 16, padding: '14px 16px', marginTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>📋 协同规则（方案 A）</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                '✅ 所有成员可查看账本全部账目',
                '✅ 所有成员可在账本中记账',
                '✅ 每人只能编辑/删除自己的记录',
                '🛡️ 所有者可修改成员角色或移除成员',
              ].map((t, i) => (
                <p key={i} style={{ fontSize: 12, color: '#374151', margin: 0 }}>{t}</p>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
