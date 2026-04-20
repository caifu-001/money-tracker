const https = require('https');

const SUPABASE_URL = 'https://abkscyijuvkfeazhlquz.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxMjU0MiwiZXhwIjoyMDg5OTg4NTQyfQ.tVBp64EO05d6ADTv7Mb9PvSPgPdmXF-_fiYoA2tzpow';

const sql = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can read settings" ON app_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can modify settings" ON app_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO app_settings (key, value) VALUES ('auto_approve', 'false') ON CONFLICT (key) DO NOTHING;
`;

const postData = JSON.stringify({ query: sql });

const url = new URL(SUPABASE_URL + '/rest/v1/rpc/exec_sql');
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Length': Buffer.byteLength(postData)
  }
};

// Try using the query endpoint directly
const url2 = new URL(SUPABASE_URL + '/pg/query');
const opts2 = {
  hostname: url2.hostname,
  path: url2.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(opts2, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});
req.on('error', e => {
  console.log('直接API也不行，需要用Supabase Dashboard SQL编辑器手动执行:');
  console.log(sql);
});
req.write(postData);
req.end();
