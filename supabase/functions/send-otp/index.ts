// supabase/functions/send-otp/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API = Deno.env.get('RESEND_API_KEY') || ''
const OTP_EXPIRY = 10 * 60

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
      },
    })
  }

  try {
    const { email, username, password } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('无效的邮箱地址')
    }
    if (!username || username.length < 2) {
      throw new Error('用户名至少2个字符')
    }
    if (!password || password.length < 6) {
      throw new Error('密码至少6位')
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase.from('pending_users').delete().eq('email', email)
    
    const { error: insertError } = await supabase.from('pending_users').insert([{
      email,
      username,
      password,
      otp: code,
      otp_expires_at: new Date(Date.now() + OTP_EXPIRY * 1000).toISOString(),
      attempts: 0
    }])

    if (insertError) throw insertError

    let sent = false
    if (RESEND_API) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + RESEND_API, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: '游游记账 <noreply@yourdomain.com>',
            to: email,
            subject: '【游游记账】您的注册验证码',
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#f9fafb;border-radius:16px;">
              <h2 style="color:#6366f1;margin-bottom:24px;">游游记账 - 注册验证码</h2>
              <p style="font-size:16px;color:#374151;">您好！</p>
              <p style="font-size:16px;color:#374151;">您的注册验证码是：</p>
              <div style="background:#6366f1;color:#fff;font-size:40px;font-weight:bold;text-align:center;padding:24px;margin:24px 0;border-radius:12px;letter-spacing:8px;">${code}</div>
              <p style="font-size:14px;color:#9ca3af;">验证码10分钟内有效，请勿告知他人。</p>
            </div>`
          })
        })
        sent = r.ok
      } catch (e) {
        console.error('Resend error:', e)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: sent ? '验证码已发送' : '验证码已生成（开发模式）',
      code: code  // 总是返回验证码用于开发测试
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message || '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
