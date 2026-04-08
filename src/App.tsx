import { useState } from 'react'
import { useAppStore } from './store/appStore'

// 只保留基础页面，其他页面你后续自己加回来
import { Home } from './pages/Home'
import { Ledgers } from './pages/Ledgers'
import { FloatButton } from './components/FloatButton'
import { QuickAdd } from './components/QuickAdd'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const { isQuickAddOpen, openQuickAdd, closeQuickAdd } = useAppStore()

  // 只保留最核心的弹窗关闭逻辑
  const handleCloseQuickAdd = () => {
    closeQuickAdd()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* 页面切换 */}
      {currentPage === 'home' && <Home />}
      {currentPage === 'ledgers' && <Ledgers />}

      {/* 悬浮按钮 */}
      <FloatButton onClick={openQuickAdd} />

      {/* 记账弹窗 */}
      <QuickAdd
        isOpen={isQuickAddOpen}
        onClose={handleCloseQuickAdd}
        onSuccess={() => setCurrentPage('home')}
      />

      {/* 底部导航 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', display: 'flex', justifyContent: 'space-around',
        padding: '10px 0', borderTop: '1px solid #eee'
      }}>
        <button 
          onClick={() => setCurrentPage('home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: currentPage === 'home' ? '#6366f1' : '#6b7280' }}
        >首页</button>
        <button 
          onClick={() => setCurrentPage('ledgers')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: currentPage === 'ledgers' ? '#6366f1' : '#6b7280' }}
        >账本</button>
        <button 
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
        >统计</button>
        <button 
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
        >设置</button>
      </div>
    </div>
  )
}

export default App