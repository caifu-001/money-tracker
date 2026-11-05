-- 添加分类层级支持
alter table categories add column if not exists parent_id uuid references categories(id) on delete cascade;
alter table categories add column if not exists level integer default 1;

-- 创建索引
create index if not exists idx_categories_parent_id on categories(parent_id);
create index if not exists idx_categories_level on categories(level);
