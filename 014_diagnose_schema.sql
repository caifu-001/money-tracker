-- 014_diagnose_schema.sql
-- 诊断：查所有外键的 ON DELETE 行为 + 关键列可空性
-- 用法：Supabase Dashboard → SQL Editor → 粘贴全文 → Run → 看结果

-- 1. 外键及删除行为
SELECT
  tc.table_name      AS 表,
  kcu.column_name    AS 列,
  ccu.table_name     AS 引用表,
  ccu.column_name    AS 引用列,
  rc.delete_rule     AS 删除行为
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
 AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
 AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 2. 关键列是否可空（NOT NULL 约束）
SELECT
  table_name  AS 表,
  column_name AS 列,
  is_nullable AS 可空
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('transactions','ledgers','ledger_members','categories','budgets','users')
  AND column_name IN ('user_id','ledger_id','owner_id','parent_id','deleted_at','category')
ORDER BY table_name, column_name;

-- 3. 是否存在 pg_cron 扩展（决定能否定时清理）
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';
