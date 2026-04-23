const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://abkscyijuvkfeazhlquz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxMjU0MiwiZXhwIjoyMDg5OTg4NTQyfQ.tVBp64EO05d6ADTv7Mb9PvSPgPdmXF-_fiYoA2tzpow'
);

async function main() {
  const { data, error } = await supabase.from('users').select('id, name, email, status, role, wechat_openid, created_at').order('created_at', { ascending: false });
  if (error) { console.log('error:', error); return; }
  for (const u of data) {
    console.log(`[${u.status}] ${u.name} | ${u.email} | openid=${u.wechat_openid ? 'yes' : 'no'} | ${u.created_at}`);
  }
}
main();
