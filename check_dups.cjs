const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://abkscyijuvkfeazhlquz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4');

async function main() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, ledger_id, name, type')
    .is('parent_id', null);

  if (error) { console.error(error.message); return; }

  const groups = {};
  for (const c of data) {
    const key = c.ledger_id + '|' + c.name;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  const dups = Object.values(groups).filter(g => g.length > 1);
  console.log('重复组数:', dups.length);
  for (const group of dups) {
    const { data: subs } = await supabase.from('categories').select('id', { count: 'exact' }).eq('parent_id', group[0].id);
    console.log('账本:', group[0].ledger_id.slice(0,8), '| 分类:', group[0].name, '| 重复:', group.length, '| 子:', subs?.length ?? 0);
    group.forEach((c, i) => console.log(' ', i===0?'保留':'删除', c.id));
  }
}
main();
