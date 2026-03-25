-- 禁用 RLS 策略（用于开发环境）
-- 这个脚本会禁用所有表的 RLS，使开发更容易

-- 禁用 users 表的 RLS
alter table users disable row level security;

-- 禁用 ledgers 表的 RLS
alter table ledgers disable row level security;

-- 禁用 ledger_members 表的 RLS
alter table ledger_members disable row level security;

-- 禁用 transactions 表的 RLS
alter table transactions disable row level security;

-- 禁用 budgets 表的 RLS
alter table budgets disable row level security;

-- 禁用 categories 表的 RLS
alter table categories disable row level security;
