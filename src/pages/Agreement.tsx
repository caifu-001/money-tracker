import { useEffect, useRef } from 'react'

interface AgreementProps {
  embedded?: boolean
  onScrollToBottom?: () => void
}

const CONTENT = (
  <>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>一、服务说明</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, margin: 0 }}>「游游记账」是一款由个人开发者运营的家庭及个人记账理财工具。您开始使用本服务即表示您已阅读、理解并同意接受本协议的全部条款。开发者保留随时修改本协议的权利，修改后的协议将于应用内显著位置公示。如您不同意修改后的协议，您有权停止使用本服务。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>二、账户注册与登录</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, margin: 0 }}>您可通过邮箱注册或微信账号登录本服务。使用微信登录即表示您同意开发者依据相关协议获取您的OpenID、昵称及头像。您承诺账户信息真实、准确、完整，禁止冒充他人注册账户。您有责任妥善保管账户信息，因账户被盗用造成的损失由您自行承担。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>三、个人信息保护</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, margin: 0 }}>开发者严格遵守《个人信息保护法》（PIPL）、《网络安全法》等中华人民共和国相关法律法规。信息收集：仅收集为您提供服务所必需的信息，包括账户标识、昵称、头像及记账数据。信息共享：除法律法规、司法机关要求外，不会与任何第三方共享您的个人信息。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>四、数据所有权</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, margin: 0 }}>您在本服务中创建的所有账本数据归您本人所有。我们承诺不会对您的数据进行任何未经授权的访问、使用或披露。您有权随时申请注销账户并删除全部个人数据，我们将在15个工作日内完成处理。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>五、知识产权</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, margin: 0 }}>本服务的名称、标识、界面设计、代码等知识产权归开发者所有。未经授权，不得复制、修改、反编译或商业使用本服务任何内容。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>六、服务变更与中断</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, margin: 0 }}>开发者有权在必要时临时或永久修改、暂停或终止本服务的全部或部分功能，并尽可能提前通知用户。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>七、免责声明</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, margin: 0 }}>本服务按"现有状态"提供，开发者不对服务的及时性、安全性、准确性做任何明示或暗示保证。因不可抗力、网络故障或您自身原因造成的损失，开发者不承担责任。</p>
    </div>
    <div style={{ marginBottom: 0 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>八、联系我们</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, margin: 0 }}>如对本协议或隐私政策有任何疑问，请通过应用内「管理后台 → 意见反馈」联系开发者。我们将在15个工作日内回复。</p>
    </div>
  </>
)

export function Agreement({ embedded = false, onScrollToBottom }: AgreementProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // 监听滚动，通知父组件是否已滚到底
  useEffect(() => {
    const el = contentRef.current
    if (!el || !onScrollToBottom) return
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop <= el.clientHeight + 60) {
        onScrollToBottom()
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // 初始化也检查一次
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [onScrollToBottom])

  if (embedded) {
    return (
      <div ref={contentRef}
        style={{ fontFamily: 'system-ui, sans-serif', overflowY: 'auto', height: '100%' }}>
        <div style={{ paddingBottom: 16, borderBottom: '1px solid #f3f4f6', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: '0 0 4px' }}>用户协议</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Version 3.0.3 · 2026年4月</p>
        </div>
        {CONTENT}
        <p style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af', marginTop: 24, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>更新日期：2026年4月13日</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto', minHeight: '100vh', background: '#f5f0e8', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #c0392b, #8b0000)', borderRadius: 20, padding: '40px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ position: 'absolute', width: 100, height: 100, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', top: -30, right: -20 }} />
        <div style={{ position: 'absolute', width: 60, height: 60, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', bottom: -20, left: -10 }} />
        <h1 style={{ color: 'white', fontSize: 28, fontWeight: 900, position: 'relative', zIndex: 1, margin: 0 }}>用户协议</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 8, position: 'relative', zIndex: 1 }}>Version 3.0.3 · 2026年4月</p>
      </div>
      <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        {CONTENT}
      </div>
      <p style={{ textAlign: 'center', color: '#ccc', fontSize: 12, marginTop: 16 }}>更新日期：2026年4月13日</p>
      <p style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>游游记账 v3.0.3 · 游游工作室</p>
    </div>
  )
}
