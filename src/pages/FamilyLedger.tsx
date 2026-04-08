import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { UserPlus, Trash2, Crown, Eye, Edit3, Users } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = { owner: '👑 拥有者', editor: '✏️ 编辑者', viewer: '👁 查看者' }
const ROLE_COLORS: Record<string, string> = { owner: '#f59e0b', editor: '#6366f1', viewer: '#6b7280' }

export function FamilyLedger() {
  const { currentLedger, user } = useAppStore()
  const [members, setMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor'|'viewer'>('editor')
  const [inviting, setInviting] = useState(false)

  const isOwner = currentLedger?.owner_id === user?.id || user?.role === 'admin'

  useEffect(() => {
    if (currentLedger) loadMembers()
  }, [currentLedger])

  const loadMembers = async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('ledger_members')
      .select('*, users(id, name, email, role)')
      .eq('ledger_id', currentLedger!.id)
      .order('created_at')
    setMembers(data || [])
    setIsLoading(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return alert('请输入邮箱或用户名')
    setInviting(true)
    try {
      // 查找用户（支持邮箱或用户名@qianji.app）
      let email = inviteEmail.trim()
      if (!email.includes('@')) email = `${email.toLowerCase()}@qianji.app`

      const { data: targetUser } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('email', email)
        .single()

      if (!targetUser) {
        alert('找不到该用户，请确认用户名或邮箱是否正确，且对方已注册')
        return
      }

      // 检查是否已是成员
      const { data: existing } = await supabase
        .from('ledger_members')
        .select('id')
        .eq('ledger_id', currentLedger!.id)
        .eq('user_id', targetUser.id)
        .single()

      if (existing) {
        alert('该用户已经是账本成员')
        return
      }

      const { error } = await supabase.from('ledger_members').insert([{
        ledger_id: currentLedger!.id,
        user_id: targetUser.id,
        role: inviteRole
      }])

      if (error) throw error
      alert(`已成功邀请 ${targetUser.name || targetUser.email} 加入账本`)
      setInviteEmail(''); setShowInvite(false)
      await loadMembers()
    } catch (e: any) {
      alert('邀请失败：' + e.message)
    } finally {
      setInviting(false)
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    await supabase.from('ledger_members').update({ role: newRole }).eq('id', memberId)
    await loadMembers()
  }

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`确定移除成员「${memberName}」吗？`)) return
    await supabase.from('ledger_members').delete().eq('id', memberId)
    await loadMembers()
  }

  if (!currentLedger) return (
    <div style={{ textAlign:'center', padding:'60px 16px', color:'#9ca3af' }}>
      <Users size={48} style={{ margin:'0 auto 12px', opacity:0.2 }}/>
      <p>请先选择账本</p>
    </div>
  )

  return (
    <div style={{ padding:'16px', paddingBottom:'80px' }}>

      {/* 账本信息 */}
      <div style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:'20px', padding:'20px', marginBottom:'16px', color:'white' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
          <div style={{ width:'48px', height:'48px', borderRadius:'16px', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>
            {currentLedger.type === 'family' ? '👨‍👩‍👧' : currentLedger.type === 'project' ? '📁' : '👤'}
          </div>
          <div>
            <p style={{ fontWeight:700, fontSize:'18px' }}>{currentLedger.name}</p>
            <p style={{ fontSize:'12px', opacity:0.8 }}>
              {currentLedger.type === 'family' ? '家庭账本' : currentLedger.type === 'project' ? '项目账本' : '个人账本'}
              · {members.length} 位成员
            </p>
          </div>
        </div>
      </div>

      {/* 邀请成员 */}
      {isOwner && (
        <div style={{ marginBottom:'16px' }}>
          {!showInvite ? (
            <button onClick={() => setShowInvite(true)} style={{
              width:'100%', padding:'13px', borderRadius:'14px', border:'2px dashed #c7d2fe',
              background:'#f5f3ff', color:'#6366f1', fontSize:'14px', fontWeight:600,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'
            }}>
              <UserPlus size={18}/> 邀请成员加入
            </button>
          ) : (
            <form onSubmit={handleInvite} style={{ background:'white', borderRadius:'16px', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize:'14px', fontWeight:600, color:'#1f2937', marginBottom:'12px' }}>邀请新成员</p>

              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="输入用户名或邮箱"
                style={{ width:'100%', padding:'11px 14px', border:'1.5px solid #e5e7eb', borderRadius:'12px', fontSize:'14px', outline:'none', boxSizing:'border-box', marginBottom:'10px' }}/>

              {/* 权限选择 */}
              <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'8px' }}>设置权限</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px' }}>
                {([
                  { role:'editor', icon:<Edit3 size={16}/>, label:'编辑者', desc:'可记账、查看' },
                  { role:'viewer', icon:<Eye size={16}/>, label:'查看者', desc:'只能查看' },
                ] as const).map(r => (
                  <button key={r.role} type="button" onClick={() => setInviteRole(r.role)} style={{
                    padding:'10px', borderRadius:'12px', border:'2px solid',
                    borderColor: inviteRole === r.role ? '#6366f1' : '#e5e7eb',
                    background: inviteRole === r.role ? '#eef2ff' : 'white',
                    cursor:'pointer', textAlign:'left'
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', color: inviteRole === r.role ? '#6366f1' : '#6b7280', marginBottom:'2px' }}>
                      {r.icon}
                      <span style={{ fontWeight:600, fontSize:'13px' }}>{r.label}</span>
                    </div>
                    <p style={{ fontSize:'11px', color:'#9ca3af' }}>{r.desc}</p>
                  </button>
                ))}
              </div>

              <div style={{ display:'flex', gap:'8px' }}>
                <button type="submit" disabled={inviting} style={{ flex:1, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white', border:'none', borderRadius:'12px', padding:'12px', fontWeight:600, cursor:'pointer', fontSize:'14px' }}>
                  {inviting ? '邀请中...' : '确认邀请'}
                </button>
                <button type="button" onClick={() => setShowInvite(false)} style={{ padding:'12px 16px', background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:600 }}>取消</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 成员列表 */}
      <div>
        <p style={{ fontSize:'13px', fontWeight:600, color:'#6b7280', marginBottom:'10px' }}>成员列表</p>
        {isLoading ? (
          <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af' }}>加载中...</div>
        ) : members.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af' }}>
            <Users size={36} style={{ margin:'0 auto 8px', opacity:0.3 }}/>
            <p>暂无成员，邀请好友一起记账吧</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {members.map(m => {
              const memberUser = m.users
              const isMe = memberUser?.id === user?.id
              const canManage = isOwner && m.role !== 'owner' && !isMe
              return (
                <div key={m.id} style={{ background:'white', borderRadius:'14px', padding:'14px', boxShadow:'0 1px 6px rgba(0,0,0,0.05)', display:'flex', alignItems:'center', gap:'12px' }}>
                  {/* 头像 */}
                  <div style={{ width:'42px', height:'42px', borderRadius:'50%', background:'linear-gradient(135deg,#818cf8,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:'16px', flexShrink:0 }}>
                    {(memberUser?.name || memberUser?.email || '?')[0].toUpperCase()}
                  </div>
                  {/* 信息 */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <p style={{ fontWeight:600, fontSize:'14px', color:'#1f2937' }}>
                        {memberUser?.name || memberUser?.email?.split('@')[0] || '未知用户'}
                      </p>
                      {isMe && <span style={{ fontSize:'10px', background:'#eef2ff', color:'#6366f1', padding:'2px 6px', borderRadius:'20px', fontWeight:600 }}>我</span>}
                    </div>
                    <p style={{ fontSize:'12px', color:'#9ca3af', marginTop:'2px' }}>{memberUser?.email}</p>
                  </div>
                  {/* 角色 */}
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                    {canManage ? (
                      <select value={m.role} onChange={e => handleChangeRole(m.id, e.target.value)}
                        style={{ padding:'5px 8px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontWeight:600, color: ROLE_COLORS[m.role], background:'white', cursor:'pointer', outline:'none' }}>
                        <option value="editor">✏️ 编辑者</option>
                        <option value="viewer">👁 查看者</option>
                      </select>
                    ) : (
                      <span style={{ fontSize:'12px', fontWeight:600, color: ROLE_COLORS[m.role], background: m.role==='owner'?'#fef3c7':m.role==='editor'?'#eef2ff':'#f3f4f6', padding:'4px 10px', borderRadius:'20px' }}>
                        {ROLE_LABELS[m.role]}
                      </span>
                    )}
                    {canManage && (
                      <button onClick={() => handleRemove(m.id, memberUser?.name || memberUser?.email)}
                        style={{ background:'#fff1f2', border:'none', borderRadius:'8px', padding:'6px', cursor:'pointer', color:'#ef4444', display:'flex' }}>
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 权限说明 */}
      <div style={{ marginTop:'20px', background:'#f9fafb', borderRadius:'14px', padding:'14px' }}>
        <p style={{ fontSize:'13px', fontWeight:600, color:'#374151', marginBottom:'8px' }}>权限说明</p>
        {[
          { icon:<Crown size={14}/>, role:'拥有者', desc:'可管理成员、修改账本设置、查看所有记录', color:'#f59e0b' },
          { icon:<Edit3 size={14}/>, role:'编辑者', desc:'可添加/删除账目、查看所有记录', color:'#6366f1' },
          { icon:<Eye size={14}/>, role:'查看者', desc:'只能查看账目，不能修改', color:'#6b7280' },
        ].map(r => (
          <div key={r.role} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'6px' }}>
            <span style={{ color:r.color, marginTop:'1px', flexShrink:0 }}>{r.icon}</span>
            <div>
              <span style={{ fontSize:'12px', fontWeight:600, color:r.color }}>{r.role}：</span>
              <span style={{ fontSize:'12px', color:'#6b7280' }}>{r.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
