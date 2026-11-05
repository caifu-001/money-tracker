-- 021_accounts_transfer.sql
-- 资产负债账户 + 转账：解决信用卡「刷卡是支出、还款不是支出」的双计问题
--
-- 背景：
--   019/020 用「待结算」解决了外币金额何时确定的问题，但账目仍然只有
--   income / expense 两种类型。于是「用人民币账户还信用卡」若记成支出，
--   同一笔钱会被算两次（刷卡一次、还款一次）。
--
-- 口径（在 019/020 基础上追加）：
--   7) 资金账户 account_id：这笔钱从哪个账户出/进（资产或负债）
--   8) 转账 type='transfer'：账户间划转，既不是收入也不是支出，
--      不计入收支、预算、分析，只影响账户余额
--   9) 负债账户（信用卡）余额为负 = 欠款；还款是 transfer，
--      把资产账户的钱转入负债账户，负债余额回升，不产生新支出
--
-- 部署：Supabase Dashboard → SQL Editor → 粘贴全文 → Run
-- 前置：019_currency_support.sql、020_settlement_status.sql 已执行
-- 可重复执行：DDL 均为 IF NOT EXISTS / DROP-then-ADD，回填均为 NOT EXISTS 保护

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. accounts 资金账户表
--    kind = 'asset'     资产账户（现金 / 微信零钱 / 储蓄卡 …），余额为正
--    kind = 'liability' 负债账户（信用卡 / 花呗 …），余额为负表示欠款
--    initial_balance    期初余额（本位币），用于把存量资产一次性带入
--    kind_code          兼容标记：与历史 payment_method 对应，用于自动迁移
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id       uuid NOT NULL REFERENCES public.ledgers(id) ON DELETE CASCADE,
  name            text NOT NULL,
  kind            text NOT NULL DEFAULT 'asset',
  currency        text NOT NULL DEFAULT 'CNY',
  initial_balance numeric NOT NULL DEFAULT 0,
  icon            text NOT NULL DEFAULT '💳',
  kind_code       text,
  card_tail       text,                                   -- 卡号后四位（可选，便于区分多张卡）
  sort_order      integer NOT NULL DEFAULT 0,
  is_archived     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_kind_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_kind_check
  CHECK (kind IN ('asset', 'liability'));

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_currency_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_currency_check
  CHECK (currency ~ '^[A-Z]{3}$');

CREATE INDEX IF NOT EXISTS idx_accounts_ledger
  ON public.accounts (ledger_id, sort_order);

-- 同一账本内账户名不重复（归档的除外），避免选择器里出现两个「现金」
CREATE UNIQUE INDEX IF NOT EXISTS uniq_accounts_ledger_name
  ON public.accounts (ledger_id, name) WHERE is_archived = false;

-- ============================================================
-- 2. accounts RLS —— 与 vehicles 等账本内资源同规则：
--    账本 owner 或 ledger_members 成员可读写
-- ============================================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='accounts' AND policyname='accounts_select') THEN
    CREATE POLICY "accounts_select" ON public.accounts
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.ledgers l WHERE l.id = accounts.ledger_id AND l.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.ledger_members lm WHERE lm.ledger_id = accounts.ledger_id AND lm.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='accounts' AND policyname='accounts_insert') THEN
    CREATE POLICY "accounts_insert" ON public.accounts
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.ledgers l WHERE l.id = accounts.ledger_id AND l.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.ledger_members lm WHERE lm.ledger_id = accounts.ledger_id AND lm.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='accounts' AND policyname='accounts_update') THEN
    CREATE POLICY "accounts_update" ON public.accounts
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.ledgers l WHERE l.id = accounts.ledger_id AND l.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.ledger_members lm WHERE lm.ledger_id = accounts.ledger_id AND lm.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='accounts' AND policyname='accounts_delete') THEN
    CREATE POLICY "accounts_delete" ON public.accounts
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.ledgers l WHERE l.id = accounts.ledger_id AND l.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.ledger_members lm WHERE lm.ledger_id = accounts.ledger_id AND lm.user_id = auth.uid())
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT SELECT ON public.accounts TO anon;

-- ============================================================
-- 3. transactions 增加资金账户与转账对方账户
--    account_id    支出/收入的资金账户；transfer 时为「转出账户」
--    to_account_id 仅 transfer 使用 =「转入账户」
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS to_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- ============================================================
-- 4. type 放开 transfer
--    旧 CHECK 约束名不确定，用 conkey 精确定位「约束键含 type 列」的约束再删，
--    避免误删 currency / exchange_rate / settlement_status 的 CHECK
-- ============================================================
DO $$
DECLARE
  c record;
  v_attnum smallint;
BEGIN
  SELECT attnum INTO v_attnum
    FROM pg_attribute
   WHERE attrelid = 'public.transactions'::regclass
     AND attname = 'type'
     AND NOT attisdropped;

  IF v_attnum IS NOT NULL THEN
    FOR c IN
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = 'public.transactions'::regclass
         AND contype = 'c'
         AND v_attnum = ANY (conkey)
    LOOP
      EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', c.conname);
    END LOOP;
  END IF;
END $$;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'transfer'));

-- 转账必须是「有转出有转入的两个不同账户」；非转账则不允许填 to_account_id
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_transfer_accounts_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transfer_accounts_check
  CHECK (
    (type = 'transfer' AND account_id IS NOT NULL AND to_account_id IS NOT NULL AND account_id <> to_account_id)
    OR (type <> 'transfer' AND to_account_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_transactions_account
  ON public.transactions (ledger_id, account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_to_account
  ON public.transactions (ledger_id, to_account_id)
  WHERE to_account_id IS NOT NULL;

-- ============================================================
-- 5. 历史数据：为每个已存在的账本播种 5 个默认账户
--    命名与旧 payment_method 对应，便于按 kind_code 回填
-- ============================================================
INSERT INTO public.accounts (ledger_id, name, kind, kind_code, icon, sort_order)
SELECT l.id, v.name, v.kind, v.kind_code, v.icon, v.sort_order
  FROM public.ledgers l
  CROSS JOIN (VALUES
    ('现金',     'asset',     'cash',     '💵', 1),
    ('微信零钱', 'asset',     'wechat',   '💚', 2),
    ('支付宝',   'asset',     'alipay',   '💙', 3),
    ('银行卡',   'asset',     'bankcard', '🏦', 4),
    ('信用卡',   'liability', 'credit',   '💳', 5)
  ) AS v(name, kind, kind_code, icon, sort_order)
 WHERE NOT EXISTS (
        SELECT 1 FROM public.accounts a
         WHERE a.ledger_id = l.id AND a.kind_code = v.kind_code
      );

-- 回填：历史交易的 payment_method → 同账本对应 kind_code 的账户
UPDATE public.transactions t
   SET account_id = a.id
  FROM public.accounts a
 WHERE a.ledger_id = t.ledger_id
   AND a.kind_code = t.payment_method
   AND t.account_id IS NULL;

-- ============================================================
-- 6. 新建账本自动播种默认账户（前端无需改动）
--    新建账本走的是纯 insert，触发器保证账户立即存在
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_default_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.accounts (ledger_id, name, kind, kind_code, icon, sort_order) VALUES
    (NEW.id, '现金',     'asset',     'cash',     '💵', 1),
    (NEW.id, '微信零钱', 'asset',     'wechat',   '💚', 2),
    (NEW.id, '支付宝',   'asset',     'alipay',   '💙', 3),
    (NEW.id, '银行卡',   'asset',     'bankcard', '🏦', 4),
    (NEW.id, '信用卡',   'liability', 'credit',   '💳', 5);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_default_accounts ON public.ledgers;
CREATE TRIGGER trg_seed_default_accounts
  AFTER INSERT ON public.ledgers
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_accounts();

-- ============================================================
-- 7. 验证
-- ============================================================
SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (
        (table_name = 'transactions' AND column_name IN ('account_id','to_account_id'))
     OR (table_name = 'accounts')
   )
 ORDER BY table_name, ordinal_position;

-- 自检 1：每个账本都必须有资产账户与负债账户（min_asset / min_liability 必须 ≥ 1）
-- 自检 2：unbound_tx 应为 0 —— 有 payment_method 的历史交易都应回填到账户；
--         若 > 0 说明存在未知 payment_method 值，需人工建对应账户后重跑第 5 步
-- 自检 3：orphan_transfer 必须为 0
SELECT (SELECT count(*) FROM public.accounts)                                   AS account_total,
       (SELECT count(*) FROM public.ledgers l
         WHERE NOT EXISTS (SELECT 1 FROM public.accounts a
                            WHERE a.ledger_id = l.id AND a.kind = 'asset'))     AS ledgers_without_asset,
       (SELECT count(*) FROM public.ledgers l
         WHERE NOT EXISTS (SELECT 1 FROM public.accounts a
                            WHERE a.ledger_id = l.id AND a.kind = 'liability')) AS ledgers_without_liability,
       (SELECT count(*) FROM public.transactions t
         WHERE t.account_id IS NULL AND t.payment_method IS NOT NULL)           AS unbound_tx,
       (SELECT count(*) FROM public.transactions
         WHERE type = 'transfer' AND (account_id IS NULL OR to_account_id IS NULL)) AS orphan_transfer
  FROM (SELECT 1) _;
