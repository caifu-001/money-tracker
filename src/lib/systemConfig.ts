import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface SystemConfig {
  appName: string
  defaultExpenseCategories: { name: string; icon: string }[]
  defaultIncomeCategories: { name: string; icon: string }[]
}

// 默认值（数据库未配置时的兜底）
const FALLBACK: SystemConfig = {
  appName: '游游记账',
  defaultExpenseCategories: [
    { name: '食物', icon: '🍔' }, { name: '交通', icon: '🚗' },
    { name: '娱乐', icon: '🎮' }, { name: '购物', icon: '🛍️' },
    { name: '医疗', icon: '⚕️' }, { name: '教育', icon: '📚' },
    { name: '住房', icon: '🏠' }, { name: '水电', icon: '💡' },
    { name: '通讯', icon: '📱' }, { name: '保险', icon: '🛡️' },
    { name: '旅游', icon: '✈️' }, { name: '其他', icon: '📌' },
  ],
  defaultIncomeCategories: [
    { name: '工资', icon: '💰' }, { name: '奖金', icon: '🎁' },
    { name: '投资', icon: '📈' }, { name: '兼职', icon: '💼' },
    { name: '其他', icon: '📌' },
  ],
}

// 单例缓存，避免重复请求
let cachedConfig: SystemConfig | null = null
let listeners: Array<(c: SystemConfig) => void> = []

async function fetchConfig(): Promise<SystemConfig> {
  const { data } = await supabase.from('system_config').select('key, value')
  if (!data || data.length === 0) return FALLBACK
  const map: Record<string, any> = {}
  data.forEach((row: any) => { map[row.key] = row.value })
  return {
    appName: map['app_name'] ?? FALLBACK.appName,
    defaultExpenseCategories: map['default_expense_categories'] ?? FALLBACK.defaultExpenseCategories,
    defaultIncomeCategories: map['default_income_categories'] ?? FALLBACK.defaultIncomeCategories,
  }
}

export async function loadSystemConfig(): Promise<SystemConfig> {
  if (cachedConfig) return cachedConfig
  cachedConfig = await fetchConfig()
  return cachedConfig
}

export async function saveSystemConfig(patch: Partial<SystemConfig>, userId: string): Promise<void> {
  const updates: { key: string; value: any; updated_by: string; updated_at: string }[] = []
  const now = new Date().toISOString()
  if (patch.appName !== undefined)
    updates.push({ key: 'app_name', value: patch.appName, updated_by: userId, updated_at: now })
  if (patch.defaultExpenseCategories !== undefined)
    updates.push({ key: 'default_expense_categories', value: patch.defaultExpenseCategories, updated_by: userId, updated_at: now })
  if (patch.defaultIncomeCategories !== undefined)
    updates.push({ key: 'default_income_categories', value: patch.defaultIncomeCategories, updated_by: userId, updated_at: now })

  for (const u of updates) {
    await supabase.from('system_config').upsert(u, { onConflict: 'key' })
  }
  // 刷新缓存
  cachedConfig = await fetchConfig()
  listeners.forEach(fn => fn(cachedConfig!))
}

export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig>(cachedConfig ?? FALLBACK)
  useEffect(() => {
    loadSystemConfig().then(setConfig)
    listeners.push(setConfig)
    return () => { listeners = listeners.filter(fn => fn !== setConfig) }
  }, [])
  return config
}
