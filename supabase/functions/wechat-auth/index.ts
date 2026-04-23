// Supabase Edge Function: wechat-auth
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const APPID = Deno.env.get('WECHAT_APPID') || ''
const SECRET = Deno.env.get('WECHAT_SECRET') || ''

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

    return new Response(JSON.stringify({
      openid: wxData.openid,
      unionid: wxData.unionid || null,
      session_key: wxData.session_key
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
