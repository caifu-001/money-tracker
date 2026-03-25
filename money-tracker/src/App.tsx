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
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (authMode === 'signup') {
        const { error } = await authService.signUp(email, password, name)
        if (error) throw error
        alert('注册成功！请等待管理员审核后登录')
        setAuthMode('login')
      } else {
        const { error } = await authService.signIn(email, password)
        if (error) throw error
        const currentUser = await authService.getCurrentUser()
        if (currentUser) {
          await fetchUserAndLedger(currentUser, setUser, setCurrentLedger)
          setIsAuthPage(false)
        }
      }
    } catch (error: any) {
      alert(error.message || '认证失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await authService.signOut()
    setUser(null)
    setCurrentLedger(null)
    setIsAuthPage(true)
    setEmail('')
    setPassword('')
    setName('')
  }

  // ─── 登录/注册页面 ────────────────────────────────────────────────
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-5 rounded-full" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white opacity-5 rounded-full" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white bg-opacity-20 rounded-3xl mb-4 backdrop-blur-sm">
              <span className="text-4xl">💰</span>
            </div>
            <h1 className="text-3xl font-bold text-white">钱迹</h1>
            <p className="text-white text-opacity-80 mt-1">智能记账，轻松管理财务</p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  authMode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                登录
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  authMode === 'signup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                注册
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div className="relative">
                  <User className="absolute left-4 top-3.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="您的姓名"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
              )}

              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-400 text-sm font-medium">@</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱地址"
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-400">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3.5 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 active:scale-95"
              >
                {isLoading ? '处理中...' : authMode === 'login' ? '登录' : '注册账号'}
              </button>
            </form>

            {authMode === 'signup' && (
              <p className="text-xs text-gray-400 text-center mt-4">
                注册后需等待管理员审核才能使用
              </p>
            )}
          </div>
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
