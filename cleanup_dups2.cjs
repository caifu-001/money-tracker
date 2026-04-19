const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://abkscyijuvkfeazhlquz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4');

// 每个重复组：第一个保留，其余迁移子分类后删除
const GROUPS = [
  { ledger: 'fbf644f5', name: '居家', keep: '0caedbef-c6f2-48c3-b14a-5030c1aa2d53', del: ['50c5c3db-cc69-4f1a-ac56-d9bf9439c3da', '15982503-7a80-4f32-9dcd-da2fe583b593'] },
  { ledger: 'fbf644f5', name: '旅游', keep: '3027a197-d16c-4ff3-b39f-11b4370f05b9', del: ['7157741e-ac66-4bd5-b6a1-264a2ea1e5ba', '4be5b255-bf0b-4272-b139-2d379d619285'] },
  { ledger: 'f832c5a4', name: '人情往来', keep: '1d136174-fb35-482f-bb28-1aee385c1bc8', del: ['06a7de29-fa55-464e-ab3b-849aec75849d'] },
  { ledger: 'ace9a059', name: '人情往来', keep: '9f14e69a-d1c2-45f9-98b6-eef4de1520cd', del: ['edbc8218-3aa8-4805-9874-f440ab960efd'] },
  { ledger: 'f80ea671', name: '人情往来', keep: 'f7ae90f0-4343-4821-9721-9c0126d11a42', del: ['445ecfa8-2b53-4f67-b50b-2e2f96296542'] },
  { ledger: 'fc1faa80', name: '人情往来', keep: 'ce90b3fb-38ad-457d-b1e4-4359f80ae1f1', del: ['cceb47da-d455-4801-a0f6-49f1f42b9e99'] },
  { ledger: 'fbf644f5', name: '人情往来', keep: '4e894c2e-0b49-46e5-b6a4-43fd5f4c8453', del: ['9fe8a5e4-3167-4ccc-863e-a0a3ab0d4c9a', '36ef356e-acae-407b-a26d-22be2296fa2e'] },
  { ledger: 'fbf644f5', name: '养车', keep: '6fc13ef3-48b6-4711-93f2-c709f269ba42', del: ['6d90da90-adf7-4fe8-a5e0-afde508034c8'] },
];

async function migrateChildren(parentId, newParentId) {
  const { data, error } = await supabase
    .from('categories')
    .update({ parent_id: newParentId })
    .eq('parent_id', parentId)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

async function deleteRoot(id) {
  // 先确认它确实是根目录（parent_id IS NULL）
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .is('parent_id', null)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

async function main() {
  let totalMoved = 0;
  let totalDeleted = 0;

  for (const group of GROUPS) {
    console.log(`处理: ${group.ledger.slice(0,8)} | ${group.name}`);
    // 迁移每个要删除的根的子分类
    for (const delId of group.del) {
      const moved = await migrateChildren(delId, group.keep);
      console.log(`  子分类迁移: ${delId.slice(0,8)} -> ${group.keep.slice(0,8)} (${moved}条)`);
      totalMoved += moved;
    }
    // 删除重复根目录
    for (const delId of group.del) {
      const deleted = await deleteRoot(delId);
      console.log(`  删除: ${delId.slice(0,8)} (实际删${deleted}条)`);
      totalDeleted += deleted;
    }
    console.log('');
  }

  console.log('完成！共迁移子分类:', totalMoved, '条，删除重复根目录:', totalDeleted, '条');
}
main().catch(e => { console.error(e.message); process.exit(1); });
