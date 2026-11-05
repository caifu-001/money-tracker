// 用 service_role key 通过 Supabase Management API 创建表
const https = require('https');

const PROJECT_REF = 'abkscyijuvkfeazhlquz';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxMjU0MiwiZXhwIjoyMDg5OTg4NTQyfQ.tVBp64EO05d6ADTv7Mb9PvSPgPdmXF-_fiYoA2tzpow';

// 尝试直接用 supabase-js 的 from 操作
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://abkscyijuvkfeazhlquz.supabase.co', SERVICE_KEY);

async function main() {
  // 方法1：直接给 users 表加 auto_approve 列（不行，需要 ALTER TABLE）
  
  // 方法2：利用 supabase 的 upsert 创建 app_settings 表的数据
  // 先试试能否直接往 app_settings 插入，如果表不存在就提示
  
  // 方法3：直接在 users 表中用 JSONB 字段存设置
  // 检查 users 表有没有 settings 列
  const { data, error } = await supabase.from('users').select('id').limit(1);
  console.log('users表查询:', data ? 'OK' : error?.message);
  
  // 试试用 RPC 执行 SQL
  // 不行的话，最简单方案：在 users 表加一个 auto_approve boolean 列
  
  // 用 PostgreSQL REST API 试一下
  const sql = "ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT FALSE; UPDATE users SET auto_approve = false WHERE auto_approve IS NULL;";
  
  // 用 fetch 直接调
  try {
    const resp = await fetch('https://abkscyijuvkfeazhlquz.supabase.co/rest/v1/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
      }
    });
    console.log('REST API test:', resp.status);
  } catch(e) {
    console.log('fetch error:', e.message);
  }
  
  console.log('\n需要手动在 Supabase Dashboard SQL Editor 执行:');
  console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT FALSE;');
}
main();
