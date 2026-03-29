// utils/supabase.js - Supabase 客户端（微信小程序版）
// 微信小程序不支持 fetch，需要用 wx.request 封装

const SUPABASE_URL = 'https://abkscyijuvkfeazhlquz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'

// 获取当前 access_token
function getToken() {
  return wx.getStorageSync('sb_access_token') || SUPABASE_ANON_KEY
}

// 封装 wx.request 为 Promise
function wxRequest(method, url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
        'Prefer': 'return=representation',
        ...headers
      },
      success: res => resolve(res),
      fail: err => reject(err)
    })
  })
}

// ─── QueryBuilder ────────────────────────────────────────────────────────────
class QueryBuilder {
  constructor(table) {
    this.table = table
    this._url = `${SUPABASE_URL}/rest/v1/${table}`
    this._params = []
    this._method = 'GET'
    this._body = null
    this._headers = {}
  }

  select(cols = '*') {
    this._params.push(`select=${encodeURIComponent(cols)}`)
    return this
  }

  eq(col, val) {
    this._params.push(`${col}=eq.${encodeURIComponent(val)}`)
    return this
  }

  neq(col, val) {
    this._params.push(`${col}=neq.${encodeURIComponent(val)}`)
    return this
  }

  gte(col, val) {
    this._params.push(`${col}=gte.${encodeURIComponent(val)}`)
    return this
  }

  lte(col, val) {
    this._params.push(`${col}=lte.${encodeURIComponent(val)}`)
    return this
  }

  is(col, val) {
    this._params.push(`${col}=is.${val}`)
    return this
  }

  order(col, opts = {}) {
    const dir = opts.ascending === false ? 'desc' : 'asc'
    this._params.push(`order=${col}.${dir}`)
    return this
  }

  limit(n) {
    this._params.push(`limit=${n}`)
    return this
  }

  single() {
    this._headers['Accept'] = 'application/vnd.pgrst.object+json'
    return this
  }

  insert(rows) {
    this._method = 'POST'
    this._body = Array.isArray(rows) ? rows : [rows]
    return this
  }

  update(data) {
    this._method = 'PATCH'
    this._body = data
    return this
  }

  upsert(data, opts = {}) {
    this._method = 'POST'
    this._body = Array.isArray(data) ? data : [data]
    const onConflict = opts.onConflict || ''
    this._headers['Prefer'] = `resolution=merge-duplicates`
    if (onConflict) this._params.push(`on_conflict=${onConflict}`)
    return this
  }

  delete() {
    this._method = 'DELETE'
    return this
  }

  async then(resolve, reject) {
    try {
      const qs = this._params.length ? '?' + this._params.join('&') : ''
      const res = await wxRequest(this._method, this._url + qs, this._body, this._headers)
      if (res.statusCode >= 400) {
        resolve({ data: null, error: { message: res.data?.message || `HTTP ${res.statusCode}` } })
      } else {
        resolve({ data: res.data, error: null })
      }
    } catch(e) {
      reject({ data: null, error: e })
    }
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = {
  async signInWithPassword({ email, password }) {
    const res = await wxRequest('POST', `${SUPABASE_URL}/auth/v1/token?grant_type=password`, { email, password })
    if (res.statusCode === 200 && res.data.access_token) {
      wx.setStorageSync('sb_access_token', res.data.access_token)
      wx.setStorageSync('sb_refresh_token', res.data.refresh_token)
      return { data: { user: res.data.user, session: res.data }, error: null }
    }
    return { data: null, error: { message: res.data?.error_description || '登录失败' } }
  },

  async signUp({ email, password, options }) {
    const res = await wxRequest('POST', `${SUPABASE_URL}/auth/v1/signup`, {
      email, password,
      data: options?.data || {}
    })
    if (res.statusCode === 200 || res.statusCode === 201) {
      return { data: { user: res.data.user }, error: null }
    }
    return { data: null, error: { message: res.data?.msg || res.data?.error_description || '注册失败' } }
  },

  async signOut() {
    const token = wx.getStorageSync('sb_access_token')
    if (token) {
      await wxRequest('POST', `${SUPABASE_URL}/auth/v1/logout`, {}, { Authorization: `Bearer ${token}` })
    }
    wx.removeStorageSync('sb_access_token')
    wx.removeStorageSync('sb_refresh_token')
    return { error: null }
  },

  async getUser() {
    const token = wx.getStorageSync('sb_access_token')
    if (!token || token === SUPABASE_ANON_KEY) return { data: { user: null }, error: null }
    const res = await wxRequest('GET', `${SUPABASE_URL}/auth/v1/user`, null)
    if (res.statusCode === 200) return { data: { user: res.data }, error: null }
    return { data: { user: null }, error: null }
  },

  async resetPasswordForEmail(email) {
    const res = await wxRequest('POST', `${SUPABASE_URL}/auth/v1/recover`, { email })
    return res.statusCode === 200 ? { error: null } : { error: { message: '发送失败' } }
  }
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────
const supabase = {
  auth,
  from: (table) => new QueryBuilder(table)
}

module.exports = { supabase, SUPABASE_URL, SUPABASE_ANON_KEY }
