import { useAppStore } from '../store/appStore'

export function FloatButton() {
  const openQuickAdd = useAppStore(s => s.openQuickAdd)
  return (
    <button
      onClick={openQuickAdd}
      style={{
        position: 'fixed',
        bottom: '82px',
        right: 'max(16px, calc(50% - 224px))',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 24px rgba(99,102,241,0.55)',
        zIndex: 39,
        lineHeight: 1,
      }}
      aria-label="快速记账"
    >
      +
    </button>
  )
}
