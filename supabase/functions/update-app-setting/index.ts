import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { key, value } = await req.json()
    
    if (!key || value === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing key or value' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // 使用 upsert 更新或插入
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' })
    
    if (error) {
      console.error('Upsert error:', error)
      return new Response(
        JSON.stringify({ error: error.message }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ success: true, key, value }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('Function error:', e)
    return new Response(
      JSON.stringify({ error: e.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
