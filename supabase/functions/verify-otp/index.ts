// supabase/functions/verify-otp/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { email, code } = await req.json()

    if (!email || !code) {
      throw new Error('参数不完整')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: pending, error: fetchError } = await supabase
      .from('pending_users')
      .select('*')
      .eq('email', email)
      .single()

    if (fetchError || !pending) {
      throw new Error('验证码已过期或不存在，请重新注册')
    }

    if (pending.otp !== code) {
      await supabase.from('pending_users').update({ attempts: (pending.attempts || 0) + 1 }).eq('id', pending.id)
      const left = 3 - (pending.attempts || 0)
      throw new Error('验证码错误，剩余' + left + '次尝试机会')
    }

    if (new Date(pending.otp_expires_at) < new Date()) {
      throw new Error('验证码已过期，请重新获取')
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: pending.email,
      password: pending.password,
      email_confirm: true,
      user_metadata: { name: pending.username }
    })

    if (authError) throw authError

    await supabase.from('users').upsert([{
      id: authData.user.id,
      email: pending.email,
      name: pending.username,
      role: 'user',
      status: 'pending'
    }], { onConflict: 'id' })

    await supabase.from('pending_users').delete().eq('id', pending.id)

    return new Response(JSON.stringify({ success: true }), {
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
