// Supabase Edge Function: wechat-auth
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const APPID = Deno.env.get('WECHAT_APPID') || ''
const SECRET = Deno.env.get('WECHAT_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://abkscyijuvkfeazhlquz.supabase.co'
// 优先读自定义 secret（新 sb_secret_ key），回退到系统保留变量（Legacy 已失效）
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MY_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// ─── 轻量内存限流（防滥用 service_role 重置能力）───
// 每 IP 每 60 秒最多 20 次；单实例内有效，冷启动/多实例会重置计数。
// 这是「防脚本爆破」级别的加固，非高精度限流。
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const rateMap = new Map()
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (rateMap.get(ip) || []).filter((t: number) => now - t < RATE_WINDOW_MS)
  arr.push(now)
  rateMap.set(ip, arr)
  if (arr.length > RATE_MAX) return true
  // 防 Map 无限增长：定时清空过期条目
  if (rateMap.size > 5000) {
    for (const [k, v] of rateMap) {
      const alive = v.filter((t: number) => now - t < RATE_WINDOW_MS)
      if (alive.length === 0) rateMap.delete(k)
    }
  }
  return false
}

// 与小程序 utils/supabase.js deriveWechatPassword 保持完全一致
function deriveWechatPassword(openid: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < openid.length; i++) {
    h ^= openid.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  const tail = String(openid).replace(/[^a-zA-Z0-9]/g, '').slice(-6)
  return 'wx' + tail + h.toString(36)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  // 限流（基于来源 IP）
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  try {
    const { code, appid } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ error: '缺少 code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const useAppid = appid || APPID
    const useSecret = SECRET

    if (!useSecret) {
      return new Response(JSON.stringify({ error: '未配置微信密钥' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${useAppid}&secret=${useSecret}&js_code=${code}&grant_type=authorization_code`
    const wxRes = await fetch(url)
    const wxData = await wxRes.json()

    if (wxData.errcode) {
      return new Response(JSON.stringify({ error: wxData.errmsg, code: wxData.errcode }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const openid = wxData.openid as string

    // 用 service_role 按 openid 查用户（RLS 收紧后，前端无法再用 anon 查 openid）
    // 返回 email/name/role/status 供前端判断「老用户/新用户」并换 token
    let userInfo: { email: string; name: string; role: string; status: string } | null = null

    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const findRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?wechat_openid=eq.${encodeURIComponent(openid)}&select=id,email,name,role,status`,
          {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            }
          }
        )
        if (findRes.status === 200) {
          const rows = await findRes.json()
          if (rows && rows.length > 0) {
            userInfo = {
              email: rows[0].email,
              name: rows[0].name,
              role: rows[0].role,
              status: rows[0].status,
            }
            // 存量用户兜底：把 auth.users 密码重置为派生密码（幂等）
            // 保证前端 signInWithPassword 一定能成功
            const derived = deriveWechatPassword(openid)
            const updRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${rows[0].id}`, {
              method: 'PUT',
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ password: derived }),
            })
            if (updRes.status >= 400) {
              console.error('[wechat-auth] 重置密码失败:', await updRes.text())
            }
          }
        } else {
          console.error('[wechat-auth] 查询用户失败:', findRes.status, await findRes.text())
        }
      } catch (e) {
        console.error('[wechat-auth] 存量用户兜底异常:', e)
      }
    } else {
      console.error('[wechat-auth] 未配置 SUPABASE_SERVICE_ROLE_KEY，跳过密码重置')
    }

    return new Response(JSON.stringify({
      openid,
      unionid: wxData.unionid || null,
      email: userInfo ? userInfo.email : null,
      name: userInfo ? userInfo.name : null,
      role: userInfo ? userInfo.role : null,
      status: userInfo ? userInfo.status : null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
