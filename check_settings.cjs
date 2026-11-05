const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://abkscyijuvkfeazhlquz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQxMjU0MiwiZXhwIjoyMDg5OTg4NTQyfQ.tVBp64EO05d6ADTv7Mb9PvSPgPdmXF-_fiYoA2tzpow'
);

async function main() {
  const { data, error } = await supabase.from('app_settings').select('*');
  console.log('data:', JSON.stringify(data));
  console.log('error:', JSON.stringify(error));
}
main();
