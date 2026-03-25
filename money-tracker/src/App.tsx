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
import { QuickAdd } from './components/QuickAdd'
import { FloatButton } from './components/FloatButton'
import {
  Home as HomeIcon, Wallet, TrendingUp, BookOpen,
  Settings, LogOut, Layers, User, Eye, EyeOff
} from 'lucide-react'

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset'
type Page = 'home' | 'budget' | 'analytics' | 'categories' | 'ledgers' | 'admin'

async function fetchUserAndLedger(
  currentUser: any,
  setUser: (u: any) => void,
  setCurrentLedger: (l: any) => void
) {
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

  try {
    let query = supabase
      .from('ledgers')
      .select('*')
      .order('created_at', { ascending: false })
    if (userRole !== 'admin') {
      query = query.eq('owner_id', currentUser.id)
    }
    const { data } = await query.limit(1)
    if (data && data.length > 0) setCurrentLedger(data[0])
  } catch {}
}

function App() {
  const { user, setUser, setCurrentLedger } = useAppStore()
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isAuthPage, setIsAuthPage] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [loginId, setLoginId] = useState('')   // 用户名或邮箱
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (authMode === 'forgot') {
        // 发送密码重置邮件
        const { error } = await authService.resetPassword(loginId || email)
        if (error) throw error
        setResetSent(true)
      } else if (authMode === 'reset') {
        // 设置新密码
        const { error } = await authService.updatePassword(newPassword)
        if (error) throw error
        setResetSuccess(true)
        setTimeout(() => {
          window.location.hash = ''
          setAuthMode('login')
          setResetSuccess(false)
        }, 2000)
      } else if (authMode === 'signup') {
        const { error } = await authService.signUp(loginId || email, password, name)
        if (error) throw error
        alert('注册成功！请等待管理员审核后登录')
        setAuthMode('login')
      } else {
        const { error } = await authService.signIn(loginId || email, password)
        if (error) throw error
        const currentUser = await authService.getCurrentUser()
        if (currentUser) {
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
  }

  // ─── 登录/注册页面 ────────────────────────────────────────────────
  if (isAuthPage) {
    // 标题和副标题映射
    const modeConfig = {
      login:  { title: '欢迎回来',   sub: '登录你的账号' },
      signup: { title: '创建账号',   sub: '开始记录你的财务' },
      forgot: { title: '找回密码',   sub: '输入账号，我们发送重置链接' },
      reset:  { title: '设置新密码', sub: '请输入你的新密码' },
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
              background:'rgba(255,255,255,0.2)', backdropFilter:'blur(10px)', marginBottom:'12px'
            }}>
              <span style={{ fontSize:'34px' }}>💰</span>
            </div>
            <div style={{ color:'white', fontSize:'22px', fontWeight:700 }}>{cfg.title}</div>
            <div style={{ color:'rgba(255,255,255,0.75)', fontSize:'13px', marginTop:'4px' }}>{cfg.sub}</div>
          </div>

          {/* 卡片 */}
          <div style={{ background:'white', borderRadius:'24px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>

            {/* Tab（仅登录/注册显示） */}
            {(authMode === 'login' || authMode === 'signup') && (
              <div style={{ display:'flex', background:'#f3f4f6', margin:'16px 16px 0', borderRadius:'14px', padding:'4px' }}>
                {(['login','signup'] as const).map(m => (
                  <button key={m} onClick={() => setAuthMode(m)} style={{
                    flex:1, padding:'9px 0', borderRadius:'10px', border:'none', cursor:'pointer',
                    fontSize:'14px', fontWeight:600, transition:'all 0.2s',
                    background: authMode === m ? 'white' : 'transparent',
                    color: authMode === m ? '#6366f1' : '#9ca3af',
                    boxShadow: authMode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
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

              {/* 新密码（重置） */}
              {authMode === 'reset' && (
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:'13px', top:'11px', fontSize:'14px' }}>🔑</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="输入新密码"
                    style={{ width:'100%', paddingLeft:'36px', paddingRight:'44px', paddingTop:'11px', paddingBottom:'11px', border:'1.5px solid #e5e7eb', borderRadius:'12px', fontSize:'14px', background:'#f9fafb', outline:'none', boxSizing:'border-box' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position:'absolute', right:'12px', top:'10px', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'2px' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
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
                    login: '登 录', signup: '注 册', forgot: '发送重置链接', reset: '确认新密码'
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
            钱迹 · 智能记账
          </p>
        </div>
      </div>
    )
  }

  // ─── 主应用 ───────────────────────────────────────────────────────
  const navItems: { page: Page; icon: React.ReactNode; label: string }[] = [
    { page: 'home',       icon: <HomeIcon size={22} />,   label: '首页' },
    { page: 'budget',     icon: <Wallet size={22} />,     label: '预算' },
    { page: 'analytics',  icon: <TrendingUp size={22} />, label: '分析' },
    { page: 'categories', icon: <Layers size={22} />,     label: '类别' },
    { page: 'ledgers',    icon: <BookOpen size={22} />,   label: '账本' },
    { page: 'admin',      icon: <Settings size={22} />,   label: '管理' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              钱迹
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full">
              <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {(user?.name || user?.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-gray-600 max-w-[80px] truncate">
                {user?.name || user?.email}
              </span>
              {user?.role === 'admin' && (
                <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">
                  管理员
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-400 hover:text-red-500"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-2xl mx-auto">
        {currentPage === 'home'       && <Home />}
        {currentPage === 'budget'     && <Budget />}
        {currentPage === 'analytics'  && <Analytics onBack={() => setCurrentPage('home')} />}
        {currentPage === 'categories' && <Categories />}
        {currentPage === 'ledgers'    && <Ledgers />}
        {currentPage === 'admin'      && <Admin />}
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border-t border-gray-100 shadow-lg flex">
            {navItems.map(({ page, icon, label }) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-all ${
                  currentPage === page ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${
                  currentPage === page ? 'bg-indigo-50' : ''
                }`}>
                  {icon}
                </div>
                <span className={`text-[10px] font-medium ${
                  currentPage === page ? 'text-indigo-600' : 'text-gray-400'
                }`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 悬浮记账按钮 */}
      <FloatButton onClick={() => setIsQuickAddOpen(true)} />

      {/* 快速记账弹窗 */}
      <QuickAdd
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={() => setCurrentPage('home')}
      />
    </div>
  )
}

export default App
