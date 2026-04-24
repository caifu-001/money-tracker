// utils/supabase.js - 微信小程序版 Supabase 客户端（修复版）
const SUPABASE_URL = 'https://abkscyijuvkfeazhlquz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4'

let _refreshing = null

function getToken() {
  return wx.getStorageSync('sb_access_token') || SUPABASE_ANON_KEY
}

function wxRequest(method, url, data, headers = {}) {
  return new Promise((resolve) => {
    wx.request({
      url, method, data,
      header: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + getToken(),
        'Prefer': 'return=representation',
        ...headers
      },
      success: (res) => resolve(res),
      fail: (err) => resolve({ statusCode: 0, data: null, err })
    })
  })
}

async function refreshToken() {
  if (_refreshing) return _refreshing
  const refresh = wx.getStorageSync('sb_refresh_token')
  if (!refresh) return null
  _refreshing = (async () => {
    try {
      const res = await wxRequest('POST', SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', { refresh_token: refresh })
      if (res.statusCode === 200 && res.data && res.data.access_token) {
        wx.setStorageSync('sb_access_token', res.data.access_token)
        wx.setStorageSync('sb_refresh_token', res.data.refresh_token || refresh)
        return res.data.access_token
      }
    } catch(e) {}
    wx.removeStorageSync('sb_access_token')
    wx.removeStorageSync('sb_refresh_token')
    return null
  })()
  return _refreshing
}

// ─── QueryBuilder ───────────────────────────────────────────────────
class QueryBuilder {
  constructor(table) {
    this.table = table
    this._url = SUPABASE_URL + '/rest/v1/' + table
    this._params = []
    this._method = 'GET'
    this._body = null
    this._headers = {}
    this._retried = false
    this._orders = []  // 收集多个排序
  }

  select(cols) { this._params.push('select=' + encodeURIComponent(cols || '*')); return this }
  eq(col, val) { this._params.push(encodeURIComponent(col) + '=eq.' + encodeURIComponent(val)); return this }
  neq(col, val) { this._params.push(encodeURIComponent(col) + '=neq.' + encodeURIComponent(val)); return this }
  gte(col, val) { this._params.push(encodeURIComponent(col) + '=gte.' + encodeURIComponent(val)); return this }
  lte(col, val) { this._params.push(encodeURIComponent(col) + '=lte.' + encodeURIComponent(val)); return this }
  is(col, val) { this._params.push(encodeURIComponent(col) + '=is.' + encodeURIComponent(String(val))); return this }
  in(col, vals) { this._params.push(encodeURIComponent(col) + '=in.(' + vals.map(v => encodeURIComponent(String(v))).join(',') + ')'); return this }
  order(col, opts) { this._orders.push(encodeURIComponent(col) + '.' + (opts && opts.ascending === false ? 'desc' : 'asc')); return this }
  limit(n) { this._params.push('limit=' + n); return this }
  single() { this._headers['Accept'] = 'application/vnd.pgrst.object+json'; return this }
  maybeSingle() { this._headers['Accept'] = 'application/vnd.pgrst.object+json'; this._headers['Prefer'] = 'missing=default'; return this }

  insert(rows) { this._method = 'POST'; this._body = Array.isArray(rows) ? rows : [rows]; return this }
  update(data) { this._method = 'PATCH'; this._body = data; return this }
  upsert(data, opts) {
    this._method = 'POST'
    this._body = Array.isArray(data) ? data : [data]
    this._headers['Prefer'] = 'resolution=merge-duplicates'
    if (opts && opts.onConflict) this._params.push('on_conflict=' + encodeURIComponent(opts.onConflict))
    return this
  }
  delete() { this._method = 'DELETE'; return this }

  then(resolve, reject) {
    // 合并所有排序参数
    if (this._orders.length > 0) {
      this._params.push('order=' + this._orders.join(','))
    }
    const qs = this._params.length ? '?' + this._params.join('&') : ''
    if (this._method !== 'GET') {
      console.log('[supabase]', this._method, this._url + qs, JSON.stringify(this._body))
    }
    wxRequest(this._method, this._url + qs, this._body, this._headers).then((res) => {
      console.log('[supabase] response status:', res.statusCode, 'data:', JSON.stringify(res.data))
      if (res.statusCode === 401 && !this._retried) {
        this._retried = true
        refreshToken().then(() => {
          wxRequest(this._method, this._url + qs, this._body, this._headers).then((res2) => {
            if (res2.statusCode >= 400) {
              resolve({ data: null, error: { message: (res2.data && (res2.data.message || res2.data[0]?.message)) || 'HTTP ' + res2.statusCode } })
            } else {
              resolve({ data: res2.data, error: null })
            }
          })
        })
      } else if (res.statusCode >= 400) {
        console.log('[supabase] error response:', JSON.stringify(res.data))
        resolve({ data: null, error: { message: (res.data && (res.data.message || res.data[0]?.message)) || 'HTTP ' + res.statusCode } })
      } else {
        resolve({ data: res.data, error: null })
      }
    })
  }
}

// ─── Auth ────────────────────────────────────────────────────────────
const auth = {
  async signInWithPassword(creds) {
    const res = await wxRequest('POST', SUPABASE_URL + '/auth/v1/token?grant_type=password', { email: creds.email, password: creds.password })
    if (res.statusCode === 200 && res.data && res.data.access_token) {
      wx.setStorageSync('sb_access_token', res.data.access_token)
      wx.setStorageSync('sb_refresh_token', res.data.refresh_token || '')
      return { data: { user: res.data.user, session: res.data }, error: null }
    }
    const msg = res.data && (res.data.error_description || res.data.msg || res.data.error) || '登录失败'
    return { data: null, error: { message: msg } }
  },

  async signUp(creds) {
    const res = await wxRequest('POST', SUPABASE_URL + '/auth/v1/signup', {
      email: creds.email, password: creds.password,
      data: (creds.options && creds.options.data) || {}
    })
    if (res.statusCode === 200 || res.statusCode === 201) {
      return { data: { user: res.data && res.data.user }, error: null }
    }
    const msg = res.data && (res.data.msg || res.data.error_description || res.data.error) || '注册失败'
    return { data: null, error: { message: msg } }
  },

  async signOut() {
    const token = wx.getStorageSync('sb_access_token')
    if (token) {
      try {
        await wxRequest('POST', SUPABASE_URL + '/auth/v1/logout', {}, { Authorization: 'Bearer ' + token })
      } catch(e) {}
    }
    wx.removeStorageSync('sb_access_token')
    wx.removeStorageSync('sb_refresh_token')
    return { error: null }
  },

  async resetPasswordForEmail(email) {
    const res = await wxRequest('POST', SUPABASE_URL + '/auth/v1/recover', { email })
    return res.statusCode === 200 ? { error: null } : { error: { message: '发送失败' } }
  }
}

// ─── 导出 ────────────────────────────────────────────────────────────
const supabase = { auth, from: (t) => new QueryBuilder(t) }
module.exports = { supabase, SUPABASE_URL, SUPABASE_ANON_KEY }
