-- 系统配置表（全局设置）
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- 插入默认配置
INSERT INTO system_config (key, value) VALUES
('app_name', '"钱迹"'),
('default_expense_categories', '[
  {"name": "食物", "icon": "🍔"},
  {"name": "交通", "icon": "🚗"},
  {"name": "娱乐", "icon": "🎮"},
  {"name": "购物", "icon": "🛍️"},
  {"name": "医疗", "icon": "⚕️"},
  {"name": "教育", "icon": "📚"},
  {"name": "住房", "icon": "🏠"},
  {"name": "水电", "icon": "💡"},
  {"name": "通讯", "icon": "📱"},
  {"name": "保险", "icon": "🛡️"},
  {"name": "旅游", "icon": "✈️"},
  {"name": "其他", "icon": "📌"}
]'),
('default_income_categories', '[
  {"name": "工资", "icon": "💰"},
  {"name": "奖金", "icon": "🎁"},
  {"name": "投资", "icon": "📈"},
  {"name": "兼职", "icon": "💼"},
  {"name": "其他", "icon": "📌"}
]')
ON CONFLICT (key) DO NOTHING;

-- 禁用 RLS
ALTER TABLE system_config DISABLE ROW LEVEL SECURITY;
