interface FloatButtonProps {
  onClick: () => void
}

export function FloatButton({ onClick }: FloatButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-5 z-40 w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full shadow-xl shadow-indigo-300 flex items-center justify-center text-3xl font-light hover:scale-110 active:scale-95 transition-all"
      aria-label="快速记账"
    >
      +
    </button>
  )
}
