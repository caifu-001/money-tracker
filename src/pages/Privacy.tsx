interface PrivacyProps {
  embedded?: boolean
}

const CONTENT = (
  <>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>一、个人信息收集</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, marginBottom: 10 }}>根据《个人信息保护法》（PIPL）的规定，个人信息是以电子或者其他方式记录的与已识别或者可识别的自然人有关的各种信息。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600, marginBottom: 8 }}>1. 微信授权信息：当您使用微信账号登录时，平台会获取您的用户标识（OpenID）、昵称和头像，用于账户识别。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600, marginBottom: 8 }}>2. 账户注册信息：邮箱账号、昵称、密码加密存储。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600 }}>3. 记账数据：您创建的账本、分类、交易记录、预算等业务数据。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>二、个人信息使用</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600, marginBottom: 8 }}>1. OpenID用于账户身份识别。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600, marginBottom: 8 }}>2. 昵称和头像用于对局界面等场景展示。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600, marginBottom: 8 }}>3. 记账数据用于生成您的收支报表和统计数据。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600 }}>4. 我们承诺不会将个人信息用于本政策说明之外的任何其他目的，也不会出售、转让或授权给任何第三方。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>三、个人信息存储</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600, marginBottom: 8 }}>1. 存储地点：中华人民共和国境内服务器。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600, marginBottom: 8 }}>2. 存储期限：账户注销后15个工作日内删除。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600 }}>3. 数据安全：采取合理的安全技术和管理措施，保护个人信息免受未经授权的访问或销毁。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>四、个人信息共享</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, marginBottom: 6 }}>除以下情形外，不会与任何第三方共享您的个人信息：</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, marginBottom: 4 }}>1. 获得您的明确同意；</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, marginBottom: 4 }}>2. 根据法律法规的规定，或司法机关、行政机关的要求必须披露；</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9 }}>3. 为保护国家利益、公共利益或他人合法权益所必需。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>五、您的权利</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, marginBottom: 6 }}>根据《个人信息保护法》，您对您的个人信息享有以下权利：知情权与决定权、查阅复制权、更正权、删除权、账户注销权。</p>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9, fontWeight: 600 }}>账户注销后删除全部个人信息。</p>
    </div>
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>六、未成年人保护</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9 }}>如果您是未满18周岁的未成年人，请在监护人的陪同下阅读本政策，并在取得监护人的同意后使用本服务。</p>
    </div>
    <div style={{ marginBottom: 0 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginBottom: 10 }}>七、联系我们</h2>
      <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9 }}>如您对本政策有任何疑问，请通过应用内「管理后台 → 意见反馈」联系我们。我们将在15个工作日内回复。</p>
    </div>
  </>
)

export function Privacy({ embedded = false }: PrivacyProps) {
  if (embedded) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ paddingBottom: 12, borderBottom: '1px solid #f3f4f6', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: '0 0 4px' }}>隐私政策</h2>
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
        <h1 style={{ color: 'white', fontSize: 28, fontWeight: 900, position: 'relative', zIndex: 1, margin: 0 }}>隐私政策</h1>
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
