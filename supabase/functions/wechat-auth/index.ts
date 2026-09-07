// Supabase Edge Function: wechat-auth
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const APPID = Deno.env.get('WECHAT_APPID') || ''
const SECRET = Deno.env.get('WECHAT_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://abkscyijuvkfeazhlquz.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

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

    // 存量用户兜底：用 service_role 按 openid 找到用户，把 auth.users 密码重置为派生密码
    // 这样前端用同一派生密码 signInWithPassword 一定能拿到 access token（auth.uid() 非空）
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const findRes = await fetch(`${SUPABASE_URL}/rest/v1/users?wechat_openid=eq.${encodeURIComponent(openid)}&select=id,email`, {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          }
        })
        if (findRes.status === 200) {
          const rows = await findRes.json()
          if (rows && rows.length > 0) {
            const derived = deriveWechatPassword(openid)
            // 调用 Supabase Auth Admin API 更新密码
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
        }
      } catch (e) {
        console.error('[wechat-auth] 存量用户兜底异常:', e)
      }
    }

    return new Response(JSON.stringify({
      openid,
      unionid: wxData.unionid || null
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
