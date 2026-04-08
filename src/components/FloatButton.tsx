interface FloatButtonProps {
  onClick: () => void
}

export function FloatButton({ onClick }: FloatButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '82px',
        right: 'max(16px, calc(50% - 224px))',  /* 始终在 #root 右侧 16px 内 */
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: '30px',
        fontWeight: 300,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
        zIndex: 39,
      }}
      aria-label="快速记账"
    >
      +
    </button>
  )
}
