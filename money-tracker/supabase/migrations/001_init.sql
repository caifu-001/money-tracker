-- 创建用户表
create table if not exists users (
  id uuid primary key default auth.uid(),
  email text unique not null,
  name text,
  role text default 'user' check (role in ('admin', 'manager', 'user')),
  status text default 'pending' check (status in ('active', 'pending')),
  created_at timestamp default now()
);

-- 创建账本表
create table if not exists ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('personal', 'family', 'project')),
  owner_id uuid not null references users(id) on delete cascade,
  created_at timestamp default now()
);

-- 创建账本成员表
create table if not exists ledger_members (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamp default now(),
  unique(ledger_id, user_id)
);

-- 创建账目表
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  amount decimal(12, 2) not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  note text,
  date date not null,
  created_at timestamp default now()
);

-- 创建预算表
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  category text not null,
  amount decimal(12, 2) not null,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null,
  created_at timestamp default now(),
  unique(ledger_id, category, month, year)
);

-- 创建分类表
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  name text not null,
  icon text,
  type text not null check (type in ('income', 'expense')),
  created_at timestamp default now()
);

-- 启用行级安全策略 (RLS)
alter table users enable row level security;
alter table ledgers enable row level security;
alter table ledger_members enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table categories enable row level security;

-- 用户表 RLS 策略
create policy "用户只能查看自己的信息" on users
  for select using (auth.uid() = id or auth.jwt() ->> 'role' = 'admin');

-- 账本表 RLS 策略
create policy "用户只能查看自己的账本" on ledgers
  for select using (
    owner_id = auth.uid() or
    exists (
      select 1 from ledger_members
      where ledger_members.ledger_id = ledgers.id
      and ledger_members.user_id = auth.uid()
    )
  );

-- 账目表 RLS 策略
create policy "用户只能查看自己账本的账目" on transactions
  for select using (
    exists (
      select 1 from ledger_members
      where ledger_members.ledger_id = transactions.ledger_id
      and ledger_members.user_id = auth.uid()
      and ledger_members.role in ('owner', 'editor', 'viewer')
    ) or
    exists (
      select 1 from ledgers
      where ledgers.id = transactions.ledger_id
      and ledgers.owner_id = auth.uid()
    )
  );

create policy "编辑者可以插入账目" on transactions
  for insert with check (
    exists (
      select 1 from ledger_members
      where ledger_members.ledger_id = transactions.ledger_id
      and ledger_members.user_id = auth.uid()
      and ledger_members.role in ('owner', 'editor')
    ) or
    exists (
      select 1 from ledgers
      where ledgers.id = transactions.ledger_id
      and ledgers.owner_id = auth.uid()
    )
  );

-- 创建索引以提高查询性能
create index if not exists idx_transactions_ledger_id on transactions(ledger_id);
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_ledger_members_user_id on ledger_members(user_id);
create index if not exists idx_budgets_ledger_id on budgets(ledger_id);
