-- 修仙：挂机觉醒 v1.0 D1 Schema
-- 创建顺序：先父表后子表

-- ─── 用户表 ───
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,
  is_admin INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── 玩家表 ───
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  gender INTEGER DEFAULT 0,
  realm_level INTEGER DEFAULT 1,           -- 境界：1练气 2筑基 3金丹 4元婴 5化神
  realm_xp INTEGER DEFAULT 0,
  ling_stone INTEGER DEFAULT 500,         -- 灵石
  spirit INTEGER DEFAULT 100,              -- 灵气
  exp INTEGER DEFAULT 0,
  current_stage INTEGER DEFAULT 1,
  max_stage INTEGER DEFAULT 0,
  gongxun INTEGER DEFAULT 0,               -- 功勋货币
  gongxun_total INTEGER DEFAULT 0,
  awakens INTEGER DEFAULT 0,               -- 觉醒次数（次神特色）
  chapter_cleared INTEGER DEFAULT 0,
  campaign_progress INTEGER DEFAULT 0,     -- 主线进度
  mine_level INTEGER DEFAULT 0,           -- 矿洞等级
  goblin_level INTEGER DEFAULT 0,          -- 哥布林村庄等级
  artifact_level INTEGER DEFAULT 0,        -- 神灯等级
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_collect TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ─── 英雄表 ───
CREATE TABLE IF NOT EXISTS heroes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  hero_key TEXT NOT NULL,                  -- 'prince', 'knight', etc.
  quality INTEGER NOT NULL,                -- 1白 2蓝 3紫 4金 5红
  star INTEGER DEFAULT 0,                  -- 升星 0-5
  level INTEGER DEFAULT 1,                  -- 等级 1-100
  slot INTEGER DEFAULT -1,                  -- 上阵槽 -1=未上阵 0=前排 1=中排 2=后排
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE (player_id, hero_key)
);

-- ─── 武器表 ───
CREATE TABLE IF NOT EXISTS weapons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quality INTEGER NOT NULL,
  grade INTEGER DEFAULT 1,
  equipped_hero_id INTEGER,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- ─── 物品表 ───
CREATE TABLE IF NOT EXISTS player_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE (player_id, item_key)
);

-- ─── 战斗日志 ───
CREATE TABLE IF NOT EXISTS battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  chapter INTEGER DEFAULT 1,
  stage INTEGER NOT NULL,
  result TEXT NOT NULL,                     -- 'win' or 'lose'
  rounds INTEGER,
  rewards_json TEXT,                       -- JSON: {exp, spirit, ling, items}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- ─── 任务日志（每日 + 终身成就）──
CREATE TABLE IF NOT EXISTS task_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  task_key TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  target INTEGER NOT NULL,
  completed_at TIMESTAMP,
  claimed_at TIMESTAMP,
  day_date DATE,
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE (player_id, task_key, day_date)
);

-- ─── 藏品 ───
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  artifact_key TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE (player_id, artifact_key)
);

-- ─── 羁绊 ───
CREATE TABLE IF NOT EXISTS bonds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  bond_key TEXT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE (player_id, bond_key)
);

-- ─── 章节进度 ───
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  cleared_stage INTEGER DEFAULT 0,
  boss_cleared INTEGER DEFAULT 0,
  story_branch TEXT,                        -- 决策点选择的分支
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE (player_id, chapter_id)
);

-- ─── 离线收益记录 ───
CREATE TABLE IF NOT EXISTS afk_collects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  collect_amount INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  rewards_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- ─── 购物记录（限购）──
CREATE TABLE IF NOT EXISTS shop_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  cost INTEGER NOT NULL,
  period TEXT NOT NULL,                     -- 'daily', 'weekly', 'lifetime'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- ─── Site Meta（小额数据：十连券数、每日首次登录奖励等）──
CREATE TABLE IF NOT EXISTS site_meta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mkey TEXT UNIQUE NOT NULL,
  mval TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_battles_player ON battles(player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_log_player ON task_log(player_id, task_key);
CREATE INDEX IF NOT EXISTS idx_chapters_player ON chapters(player_id);
