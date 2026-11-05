const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://abkscyijuvkfeazhlquz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4');

async function main() {
  // 创建 app_settings 表
  const { error } = await supabase.rpc('exec_sql', { sql: `
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    
    ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Anyone can read settings" ON app_settings FOR SELECT USING (true);
    CREATE POLICY "Admin can modify settings" ON app_settings FOR ALL USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
    );
    
    INSERT INTO app_settings (key, value) VALUES ('auto_approve', 'false') ON CONFLICT (key) DO NOTHING;
  ` });
  
  if (error) {
    console.log('RPC方式不可用，尝试手动创建...');
    // 尝试直接插入
    const { error: insertError } = await supabase.from('app_settings').insert([{ key: 'auto_approve', value: 'false' }]);
    if (insertError) {
      console.log('表可能不存在，需要在Supabase Dashboard执行SQL创建');
      console.log('SQL:');
      console.log(`
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Admin can modify settings" ON app_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

INSERT INTO app_settings (key, value) VALUES ('auto_approve', 'false') ON CONFLICT (key) DO NOTHING;
      `);
    } else {
      console.log('插入成功，表已存在');
    }
  } else {
    console.log('创建成功');
  }
  
  // 验证
  const { data, error: selectError } = await supabase.from('app_settings').select('*');
  console.log('当前设置:', data, selectError);
}
main();
