import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { authService } from './lib/services'
import { supabase } from './lib/supabase'
import { Home } from './pages/Home'
import { Budget } from './pages/Budget'
import { Ledgers } from './pages/Ledgers'
import { Admin } from './pages/Admin'
import { Analytics } from './pages/Analytics'
import { Categories } from './pages/Categories'
import { FamilyLedger } from './pages/FamilyLedger'
import { QuickAdd } from './components/QuickAdd'
import { FloatButton } from './components/FloatButton'
import { Captcha } from './components/Captcha'
import {
  Home as HomeIcon, Wallet, TrendingUp, BookOpen,
  Settings, LogOut, Layers, Eye, EyeOff, Users, UsersRound
} from 'lucide-react'

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'verify'
type Page = 'home' | 'budget' | 'analytics' | 'categories' | 'ledgers' | 'admin' | 'family'

async function fetchUserAndLedger(
  currentUser: any,
  setUser: (u: any) => void,
  setCurrentLedger: (l: any) => void
) {
  // 查询用户在 users 表的角色
  let userRole: 'admin' | 'user' = 'user'
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single()

    if (userData) {
      userRole = (userData.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user'
      setUser({
        id: currentUser.id,
        email: currentUser.email || '',
        name: userData.name || currentUser.user_metadata?.name || '',
        role: userRole
      })
    } else {
      setUser({
        id: currentUser.id,
        email: currentUser.email || '',
        name: currentUser.user_metadata?.name || '',
        role: 'user' as const
      })
    }
  } catch {
    setUser({
      id: currentUser.id,
      email: currentUser.email || '',
      name: currentUser.user_metadata?.name || '',
      role: 'user' as const
    })
  }

  // 查询该用户的账本（强制按 owner_id 过滤）
  const savedLedgerId = localStorage.getItem('qianji_default_ledger_id')
  const savedLedgerOwner = localStorage.getItem('qianji_default_ledger_owner')

  const { data } = await supabase
    .from('ledgers')
    .select('*')
    .eq('owner_id', currentUser.id)
    .order('created_at', { ascending: false })

  if (data && data.length > 0) {
    // 优先恢复用户之前设为默认的账本（仅当该账本仍属于用户时才恢复）
    if (savedLedgerId && savedLedgerOwner === currentUser.id) {
      const saved = data.find((l: any) => l.id === savedLedgerId)
      if (saved) { setCurrentLedger(saved); return }
    }
    // 否则用列表第一个
    setCurrentLedger(data[0])
  } else {
    // 该用户没有任何账本，清空当前账本
    setCurrentLedger(null)
  }
}

function App() {
  const { user, setUser, setCurrentLedger } = useAppStore()
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [isAuthPage, setIsAuthPage] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [loginId, setLoginId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [verifyEmail, setVerifyEmail] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  // 验证码 & 安全
  const [captchaValid, setCaptchaValid] = useState(false)
  const [captchaKey, setCaptchaKey] = useState(0)   // 用于强制刷新验证码
  const [failCount, setFailCount] = useState(0)
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  // 新用户创建账本
  const [showCreateLedger, setShowCreateLedger] = useState(false)
  const [newLedgerName, setNewLedgerName] = useState('')
  const [creatingLedger, setCreatingLedger] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await authService.getCurrentUser()
      if (currentUser) {
        await fetchUserAndLedger(currentUser, setUser, setCurrentLedger)
        setIsAuthPage(false)
      }
    }
    checkAuth()
  }, [setUser, setCurrentLedger])

  // 检测 URL hash 是否是密码重置回调
  useEffect(() => {
    if (window.location.hash.includes('reset-password')) {
      setIsAuthPage(true)
      setAuthMode('reset')
    }
  }, [])

  // 锁定倒计时
  const [lockRemain, setLockRemain] = useState(0)
  useEffect(() => {
    if (!lockUntil) return
    const timer = setInterval(() => {
      const remain = Math.ceil((lockUntil - Date.now()) / 1000)
      if (remain <= 0) {
        setLockUntil(null)
        setFailCount(0)
        setLockRemain(0)
        clearInterval(timer)
      } else {
        setLockRemain(remain)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [lockUntil])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    // 检查锁定
    if (lockUntil && Date.now() < lockUntil) return

    // 登录必须通过验证码（注册走邮箱验证码流程，不需要图形验证）
    if (authMode === 'login' && !captchaValid) {
      alert('请先完成验证')
      return
    }

    setIsLoading(true)
    try {
      if (authMode === 'forgot') {
        const { error } = await authService.resetPassword(loginId || email)
        if (error) throw error
        setResetSent(true)
      } else if (authMode === 'reset') {
        const { error } = await authService.updatePassword(newPassword)
        if (error) throw error
        setResetSuccess(true)
        setTimeout(() => {
          window.location.hash = ''
          setAuthMode('login')
          setResetSuccess(false)
        }, 2000)
      } else if (authMode === 'signup') {
        // 邮箱验证注册流程
        const emailVal = loginId
        if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) throw new Error('请输入有效的邮箱地址')
        if (!password || password.length < 6) throw new Error('密码至少6位')
        if (!name || name.length < 2) throw new Error('请输入用户名（至少2个字符）')
        // 注册不需要图形验证码，直接发送邮箱验证码
        const result: any = await authService.sendOtp(emailVal, name, password)
        if (result.error) throw new Error(result.error)
        // 开发模式显示验证码
        if (result.code) alert('验证码(开发模式): ' + result.code)
        setVerifyEmail(emailVal)
        setAuthMode('verify')
        setCaptchaKey(k => k + 1)
        setCaptchaValid(false)
        return
      } else if (authMode === 'verify') {
        // 验证OTP并完成注册
        if (!verifyCode || verifyCode.length < 6) throw new Error('请输入6位验证码')
        const result: any = await authService.verifyOtp(verifyEmail, verifyCode)
        if (result.error) throw new Error(result.error)
        
        // 注册成功，自动登录
        const { error: signInError } = await authService.signIn(verifyEmail, password)
        if (signInError) throw new Error('注册成功但自动登录失败，请手动登录')
        
        const currentUser = await authService.getCurrentUser()
        if (currentUser) {
          await fetchUserAndLedger(currentUser, setUser, setCurrentLedger)
          // 检查是否有账本，如果没有则显示创建账本弹窗
          const { data: ledgers } = await supabase.from('ledgers').select('*').eq('owner_id', currentUser.id)
          if (!ledgers || ledgers.length === 0) {
            // 新用户，显示创建账本弹窗
            setShowCreateLedger(true)
            setNewLedgerName('')
          } else {
            setIsAuthPage(false)
          }
        }
        setAuthMode('login')
        setLoginId(''); setPassword(''); setName(''); setVerifyCode(''); setVerifyEmail('')
        setCaptchaKey(k => k + 1)
        setCaptchaValid(false)
        return
      } else {
        // 登录
        const { error } = await authService.signIn(loginId || email, password)
        if (error) {
          // 如果是审核/禁用相关错误，直接显示，不计入失败次数
          const msg = error.message || ''
          if (msg.includes('审核') || msg.includes('禁用')) {
            throw new Error(msg)
          }
          // 登录失败，增加失败次数
          const newFail = failCount + 1
          setFailCount(newFail)
          setCaptchaKey(k => k + 1)   // 刷新验证码
          setCaptchaValid(false)
          if (newFail >= 5) {
            // 锁定 5 分钟
            setLockUntil(Date.now() + 5 * 60 * 1000)
            throw new Error('登录失败次数过多，账号已锁定 5 分钟')
          } else {
            throw new Error(`账号或密码错误（还剩 ${5 - newFail} 次机会）`)
          }
        }
        // 登录成功，重置失败次数
        setFailCount(0)
        const currentUser = await authService.getCurrentUser()
        if (currentUser) {
          // 再次检查用户状态，防止绕过
          const { data: userData } = await supabase.from('users').select('status').eq('id', currentUser.id).single()
          if (userData?.status === 'pending') {
            await authService.signOut()
            throw new Error('账号正在等待管理员审核，请耐心等待')
          }
          if (userData?.status === 'disabled') {
            await authService.signOut()
            throw new Error('账号已被禁用，请联系管理员')
          }
          await fetchUserAndLedger(currentUser, setUser, setCurrentLedger)
          setIsAuthPage(false)
        }
      }
    } catch (error: any) {
      alert(error.message || '操作失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await authService.signOut()
    setUser(null)
    setCurrentLedger(null)
    setIsAuthPage(true)
    setLoginId('')
    setEmail('')
    setPassword('')
    setName('')
    setAuthMode('login')
    setCaptchaKey(k => k + 1)
    setCaptchaValid(false)
    setFailCount(0)
  }

  // 创建账本
  const handleCreateLedger = async () => {
    if (!newLedgerName.trim()) {
      alert('请输入账本名称')
      return
    }
    setCreatingLedger(true)
    try {
      const currentUser = await authService.getCurrentUser()
      if (!currentUser) throw new Error('用户未登录')

      const { data, error } = await supabase.from('ledgers').insert([{
        name: newLedgerName.trim(),
        owner_id: currentUser.id,
        type: 'personal'
      }]).select().single()

      if (error) throw error

      // 设为当前账本并保存为默认
      setCurrentLedger(data)
      localStorage.setItem('qianji_default_ledger_id', data.id)
      localStorage.setItem('qianji_default_ledger_name', data.name)
      localStorage.setItem('qianji_default_ledger_type', data.type)
      localStorage.setItem('qianji_default_ledger_owner', data.owner_id)
      setShowCreateLedger(false)
      setNewLedgerName('')
    } catch (error: any) {
      alert(error.message || '创建账本失败')
    } finally {
      setCreatingLedger(false)
    }
  }

  // ─── 登录/注册页面 ────────────────────────────────────────────────
  if (isAuthPage) {
    // 标题和副标题映射
    const modeConfig = {
      login:  { title: '欢迎回来',   sub: '登录你的账号' },
      signup: { title: '创建账号',   sub: '开始记录你的财务' },
      forgot: { title: '找回密码',   sub: '输入账号，我们发送重置链接' },
      reset:  { title: '设置新密码', sub: '请输入你的新密码' },
      verify: { title: '验证邮箱',   sub: '输入发送到你邮箱的验证码' },
    }
    const cfg = modeConfig[authMode]

    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 60%, #f093fb 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', position: 'relative', overflow: 'hidden'
      }}>
        {/* 背景装饰 */}
        <div style={{ position:'absolute', top:'-60px', right:'-60px', width:'200px', height:'200px', background:'rgba(255,255,255,0.06)', borderRadius:'50%' }} />
        <div style={{ position:'absolute', bottom:'-80px', left:'-80px', width:'260px', height:'260px', background:'rgba(255,255,255,0.06)', borderRadius:'50%' }} />

        <div style={{ width:'100%', maxWidth:'360px', position:'relative' }}>
          {/* Logo */}
          <div style={{ textAlign:'center', marginBottom:'24px' }}>
            <div style={{
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              width:'68px', height:'68px', borderRadius:'22px',
              background:'rgba(255,255,255,0.2)', backdropFilter:'blur(10px)', marginBottom:'12px', overflow:'hidden'
            }}>
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="游游记账" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ color:'white', fontSize:'22px', fontWeight:700 }}>{cfg.title}</div>
            <div style={{ color:'rgba(255,255,255,0.75)', fontSize:'13px', marginTop:'4px' }}>{cfg.sub}</div>
          </div>

          {/* 卡片 */}
          <div style={{ background:'white', borderRadius:'24px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>

            {/* Tab（登录/注册/验证显示） */}
            {(authMode === 'login' || authMode === 'signup' || authMode === 'verify') && (
              <div style={{ display:'flex', background:'#f3f4f6', margin:'16px 16px 0', borderRadius:'14px', padding:'4px' }}>
                {(['login','signup'] as const).map(m => (
                  <button key={m} onClick={() => { setAuthMode(m); setLoginId(''); setPassword(''); setName(''); setVerifyCode(''); }} style={{
                    flex:1, padding:'9px 0', borderRadius:'10px', border:'none', cursor:'pointer',
                    fontSize:'14px', fontWeight:600, transition:'all 0.2s',
                    background: (authMode === m || authMode === 'verify' && m === 'signup') ? 'white' : 'transparent',
                    color: (authMode === m || authMode === 'verify' && m === 'signup') ? '#6366f1' : '#9ca3af',
                    boxShadow: (authMode === m || authMode === 'verify' && m === 'signup') ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
                  }}>
                    {m === 'login' ? '登录' : '注册'}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleAuth} style={{ padding:'16px 16px 20px', display:'flex', flexDirection:'column', gap:'12px' }}>

              {/* 密码重置成功 */}
              {authMode === 'reset' && resetSuccess && (
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'12px', padding:'12px', textAlign:'center', color:'#16a34a', fontSize:'14px' }}>
                  ✅ 密码已更新，正在跳转...
                </div>
              )}

              {/* 找回密码发送成功 */}
              {authMode === 'forgot' && resetSent && (
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'12px', padding:'12px', color:'#1d4ed8', fontSize:'13px', lineHeight:'1.5' }}>
                  📧 重置链接已发送！<br/>请检查你的邮箱，点击链接设置新密码。
                </div>
              )}

              {/* 姓名（注册） */}
              {authMode === 'signup' && (
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:'13px', top:'11px', fontSize:'16px' }}>👤</span>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="姓名（可选）"
                    style={{ width:'100%', paddingLeft:'38px', paddingRight:'14px', paddingTop:'11px', paddingBottom:'11px', border:'1.5px solid #e5e7eb', borderRadius:'12px', fontSize:'14px', background:'#f9fafb', outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              )}

              {/* 用户名/邮箱（登录、注册、找回密码） */}
              {authMode !== 'reset' && (
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:'13px', top:'11px', fontSize:'15px' }}>
                    {authMode === 'forgot' ? '📧' : '👤'}
                  </span>
                  <input
                    type="text"
                    value={loginId}
                    onChange={e => setLoginId(e.target.value)}
                    placeholder={authMode === 'forgot' ? '邮箱地址' : '用户名或邮箱'}
                    style={{ width:'100%', paddingLeft:'38px', paddingRight:'14px', paddingTop:'11px', paddingBottom:'11px', border:'1.5px solid #e5e7eb', borderRadius:'12px', fontSize:'14px', background:'#f9fafb', outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              )}

              {/* 密码（登录、注册） */}
              {(authMode === 'login' || authMode === 'signup') && (
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:'13px', top:'11px', fontSize:'14px' }}>🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="密码"
                    style={{ width:'100%', paddingLeft:'36px', paddingRight:'44px', paddingTop:'11px', paddingBottom:'11px', border:'1.5px solid #e5e7eb', borderRadius:'12px', fontSize:'14px', background:'#f9fafb', outline:'none', boxSizing:'border-box' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position:'absolute', right:'12px', top:'10px', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'2px' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              )}

              {/* 验证码（仅登录） */}
              {authMode === 'login' && (
                <Captcha key={captchaKey} onVerify={setCaptchaValid} />
              )}

              {/* 验证码输入（verify模式） */}
              {authMode === 'verify' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'12px', padding:'10px 14px', color:'#1d4ed8', fontSize:'13px', textAlign:'center' }}>
                    📧 验证码已发送至：{verifyEmail ? verifyEmail.replace(/^(.{2}).*(@.*)$/, '$1***$2') : ''}
                  </div>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:'13px', top:'11px', fontSize:'15px' }}>🔢</span>
                    <input type="text" value={verifyCode} maxLength={6} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="输入6位验证码"
                      style={{ width:'100%', paddingLeft:'38px', paddingRight:'14px', paddingTop:'11px', paddingBottom:'11px', border:'1.5px solid #e5e7eb', borderRadius:'12px', fontSize:'20px', background:'#f9fafb', outline:'none', boxSizing:'border-box', textAlign:'center', letterSpacing:'6px' }}
                    />
                  </div>
                </div>
              )}

              {/* 锁定提示 */}
              {lockUntil && Date.now() < lockUntil && (
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'12px', padding:'10px 14px', color:'#dc2626', fontSize:'13px', textAlign:'center' }}>
                  🔒 账号已锁定，请 {lockRemain} 秒后再试
                </div>
              )}

              {/* 忘记密码链接（仅登录页） */}
              {authMode === 'login' && (
                <div style={{ textAlign:'right', marginTop:'-4px' }}>
                  <button type="button" onClick={() => setAuthMode('forgot')}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#6366f1', fontSize:'13px', fontWeight:500 }}>
                    忘记密码？
                  </button>
                </div>
              )}

              {/* 提交按钮 */}
              {!(authMode === 'forgot' && resetSent) && (
                <button type="submit" disabled={isLoading}
                  style={{
                    width:'100%', padding:'13px', border:'none', borderRadius:'12px', cursor:'pointer',
                    fontSize:'15px', fontWeight:700, color:'white', marginTop:'4px',
                    background:'linear-gradient(135deg, #667eea, #764ba2)',
                    boxShadow:'0 4px 15px rgba(102,126,234,0.45)',
                    opacity: isLoading ? 0.6 : 1, transition:'all 0.2s'
                  }}>
                  {isLoading ? '处理中...' : {
                    login: '登 录', signup: '发送验证码', forgot: '发送重置链接', reset: '确认新密码', verify: '验证并注册'
                  }[authMode]}
                </button>
              )}

              {/* 底部提示 */}
              <div style={{ textAlign:'center', fontSize:'13px', color:'#9ca3af' }}>
                {authMode === 'signup' && '注册后需等待管理员审核才能使用'}
                {(authMode === 'forgot' || authMode === 'reset') && (
                  <button type="button" onClick={() => { setAuthMode('login'); setResetSent(false) }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#6366f1', fontSize:'13px', fontWeight:500 }}>
                    ← 返回登录
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* 底部品牌 */}
          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:'12px', marginTop:'16px' }}>
            游游记账 · 智能记账
          </p>
        </div>
      </div>
    )
  }

  // ─── 主应用 ───────────────────────────────────────────────────────
  const navItems: { page: Page; icon: React.ReactNode; label: string }[] = [
    { page: 'home',       icon: <HomeIcon size={22} />,    label: '首页' },
    { page: 'budget',     icon: <Wallet size={22} />,      label: '预算' },
    { page: 'analytics',   icon: <TrendingUp size={22} />,  label: '分析' },
    { page: 'categories', icon: <Layers size={22} />,      label: '分类' },
    { page: 'admin',      icon: <Settings size={22} />,    label: '管理' },
  ]

  // 无账本检查暂时禁用，先确保基本功能正常
  // const [needCreateLedger, setNeedCreateLedger] = useState(false)
  // const [newLedgerName, setNewLedgerName] = useState('')
  // const [creating, setCreating] = useState(false)
  // const [checkingLedger, setCheckingLedger] = useState(false)

  return (
    <div style={{ minHeight: '100dvh', background: '#f3f4f6', paddingBottom: '70px', position: 'relative' }}>
      {/* 顶部导航 */}
      <div style={{
        background: 'white', borderBottom: '1px solid #f0f0f0',
        position: 'sticky', top: 0, zIndex: 30,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>💰</span>
            <span style={{ fontSize: '17px', fontWeight: 700, background: 'linear-gradient(135deg,#6366f1,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              游游记账
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f9fafb', padding: '5px 10px', borderRadius: '20px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'linear-gradient(135deg,#818cf8,#a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '11px', fontWeight: 700, flexShrink: 0
              }}>
                {(user?.name || user?.email || '?')[0].toUpperCase()}
              </div>
              <span style={{ fontSize: '13px', color: '#4b5563', maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name || user?.email}
              </span>
              {user?.role === 'admin' && (
                <span style={{ fontSize: '10px', background: '#f3e8ff', color: '#9333ea', padding: '2px 6px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>
                  管理员
                </span>
              )}
            </div>
            <button onClick={handleLogout} style={{
              padding: '7px', background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', borderRadius: '10px'
            }}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 80 }}>
        {currentPage === 'home'       && <Home />}
        {currentPage === 'budget'     && <Budget />}
        {currentPage === 'analytics'  && <Analytics />}
        {currentPage === 'categories' && <Categories />}
        {currentPage === 'admin'      && <Admin />}
      </div>

      {/* 新用户创建账本弹窗 */}
      {showCreateLedger && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '320px', width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#1f2937' }}>
              创建你的第一个账本
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              账本是记录你所有交易的地方，可以创建多个账本来分类管理
            </p>
            <input
              type="text"
              value={newLedgerName}
              onChange={e => setNewLedgerName(e.target.value)}
              placeholder="输入账本名称（如：日常开支）"
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
                borderRadius: '8px', fontSize: '14px', marginBottom: '16px',
                boxSizing: 'border-box', outline: 'none'
              }}
              onKeyPress={e => e.key === 'Enter' && handleCreateLedger()}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setShowCreateLedger(false); setNewLedgerName('') }}
                disabled={creatingLedger}
                style={{
                  flex: 1, padding: '10px', border: '1.5px solid #e5e7eb', borderRadius: '8px',
                  background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                  color: '#6b7280', opacity: creatingLedger ? 0.5 : 1
                }}
              >
                跳过
              </button>
              <button
                onClick={handleCreateLedger}
                disabled={creatingLedger}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 600, color: 'white', opacity: creatingLedger ? 0.6 : 1
                }}
              >
                {creatingLedger ? '创建中...' : '创建账本'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部导航 —— 跟随 #root 宽度 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px',
        background: 'white', borderTop: '1px solid #f0f0f0',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)', zIndex: 40,
        display: 'flex'
      }}>
        {navItems.map(({ page, icon, label }) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            style={{
              flex: 1, padding: '8px 0 6px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '2px', border: 'none', cursor: 'pointer',
              background: 'none', transition: 'all 0.15s',
              color: currentPage === page ? '#6366f1' : '#9ca3af'
            }}
          >
            <div style={{
              padding: '3px 10px', borderRadius: '10px',
              background: currentPage === page ? '#eef2ff' : 'transparent',
            }}>
              {icon}
            </div>
            <span style={{ fontSize: '10px', fontWeight: currentPage === page ? 600 : 400 }}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* 悬浮记账按钮 */}
      <FloatButton />

      {/* 快速记账弹窗 */}
      <QuickAdd />
    </div>
  )
}

export default App
