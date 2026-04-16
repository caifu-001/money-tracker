// 全局记账弹窗状态（绕过组件闭包问题）
import { useState, useEffect } from 'react'

// 全局引用，组件外也可修改
export const globalQuickAdd = {
  isOpen: false,
  listeners: new Set<() => void>(),
  open() { this.isOpen = true; this.listeners.forEach(l => l()) },
  close() { this.isOpen = false; this.listeners.forEach(l => l()) },
}

// 在 App.tsx 中不需要 isQuickAddOpen state 了
// 全局组件在 mount 时订阅状态变化
export function useQuickAddState() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const callback = () => rerender(n => n + 1)
    globalQuickAdd.listeners.add(callback)
    return () => { globalQuickAdd.listeners.delete(callback) }
  }, [])
  return globalQuickAdd.isOpen
}
