# v1.0 设计稿：「修仙：挂机觉醒」（Cloudflare 全栈版）

> **状态：v1.0 草案（2026-10-06）**
> **老板决策**：浅眠保留 + 新做游戏，部署 Cloudflare Pages + Workers + D1，单人本地玩，未来迁独立服务器多人化

---

## 一、目标定位

| 维度 | 设计 |
|---|---|
| **游戏名称** | 次神风格「修仙：挂机觉醒」（老板说"修真觉醒"） |
| **类型** | 西方奇幻次神（次神：光之觉醒参考）+ 仙侠主题（次神美术 + 仙侠世界观） |
| **核心玩法** | 挂机放置为主 + 回合制战斗 + 剧情章节 |
| **资源** | 水晶/金币/钥匙/藏品（次神风） + 灵石/灵气/进阶石（仙侠风）混合 |
| **角色** | 10-16 英雄 + 800 技能组合（老板用自己的）|
| **单人优先** | 无双服、关闭社交、未来迁移多人化 |

---

## 二、Cloudflare 全栈架构

### 2.1 技术选型

```
Cloudflare Pages  → 静态前端（HTML/CSS/JS/Vue/React）
                   → 自动绑定：jsdelivr CDN（global edge）
                   → 打工人每月 5 万次构建免费

Cloudflare Workers → 后端 API（JS/TS，v8 引擎）
                   → KV 缓存（hot 数据）+ D1 数据库（SQLite）
                   → 每天 10 万请求免费额度
                   → 单次 CPU 10ms 限制（轻量 API OK）

D1（SQLite-on-edge）→ 数据库（每库 10GB，每行 10MB）
                   → SQL 语法与 MySQL 90% 兼容（少数差异）
                   → 内置 migrations（wrangler d1 migrations apply）

R2（Cloudflare 对象存储）→ 老板的美术资源（hero 立绘/monster 立绘/技能特效）
                   → 每月 10 GB 存储免费
                   → 自定义域名 img.game.com

GitHub 仓库        → 代码托管 + 自动触发 Pages/Workers 部署
                   → git push → 自动部署（无需 push_files.py）
```

### 2.2 目录结构

```
qianmian-xiuxian/         (浅眠 v2.14.0 继续维护)
wake-cloudflare/
├── _design_v1.md         (本设计稿)
├── _changelog.md
├── package.json
├── wrangler.toml          (Cloudflare Workers + D1 配置)
├── workers/               (后端 API)
│   ├── index.ts           (入口路由)
│   ├── api/
│   │   ├── auth.ts        (注册/登录/session)
│   │   ├── game.ts        (主城数据)
│   │   ├── battle.ts      (战斗计算)
│   │   ├── heroes.ts      (英雄列表/升级/升阶)
│   │   ├── artifacts.ts   (藏品)
│   │   ├── bonds.ts       (羁绊)
│   │   ├── shop.ts        (商店)
│   │   ├── afk.ts         (挂机/离线收益)
│   │   ├── chapters.ts    (4 章节剧情)
│   │   ├── tasks.ts       (任务)
│   │   └── save.ts        (云存档)
│   ├── db/
│   │   ├── schema.sql     (D1 表结构)
│   │   ├── seed.sql       (模板数据：8 任务/21 成就/8 商品/3 NPC)
│   │   └── migrations/    (迁移记录)
│   ├── lib/
│   │   ├── auth.ts        (JWT + cookie)
│   │   ├── battle.ts      (回合制战斗引擎)
│   │   ├── pity.ts        (保底算法)
│   │   └── helpers.ts
├── public/                (静态资源)
│   ├── index.html         (登录/注册页)
│   ├── game.html          (主城面板)
│   ├── battle.html
│   ├── hero.html
│   ├── shop.html
│   ├── chapter.html
│   ├── css/
│   │   ├── theme.css      (浅眠风格继承 + 次神美术)
│   │   └── components.css
│   ├── js/
│   │   ├── api.js         (fetch 后端 API)
│   │   ├── store.js       (Pinia/Vuex)
│   │   └── ui.js          (弹窗/通知)
│   └── assets/            (老板美术上传到这里)
│       ├── heroes/
│       │   ├── 01-prince.png
│       │   ├── 02-knight.png
│       │   └── ...
│       ├── monsters/
│       │   ├── 01-shadow-king.png
│       │   └── ...
│       ├── chapters/
│       │   ├── 1-觉醒之路.png
│       │   └── ...
│       ├── artifacts/
│       └── skills/
└── README.md              (部署说明 + 数据迁移指南)
```

### 2.3 部署流程（Cloudflare）

```bash
# 一次性安装
npm install -g wrangler
wrangler login

# 创建 D1 数据库
wrangler d1 create wake-game-db
# 输出: database_id = "xxxxx"

# 填到 wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "wake-game-db"
# database_id = "xxxxx"

# 执行 migrations
wrangler d1 migrations apply wake-game-db --remote

# 部署前端（Pages）
wrangler pages deploy public --project-name=wake-game

# 部署后端（Workers）
wrangler deploy
```

老板在 Cloudflare Dashboard 看：
- `wake-game.pages.dev` → 前端
- `wake-game.bengom.workers.dev` → 后端 API

老板也可以绑定自定义域名（**未来**）：
- `wake.bengom.com` → 前端
- `api.wake.bengom.com` → 后端 API

---

## 三、核心玩法（次神风格 + 仙侠主题）

### 3.1 资源系统（仙侠 + 次神混合）

| 资源 | 来源 | 用途 |
|---|---|---|
| **灵石** | 闯关/挂机/任务 | 通用货币（招募/升级） |
| **水晶** | 4 章节剧情奖励 | 高级招募券兑换 |
| **钥匙** | 副本掉落 | 进入剧情副本 |
| **灵气** | 挂机主线 | 主角升级 |
| **进阶石** | 挑战 BOSS | 升阶武器 |
| **精魄** | 挂机击杀 | 藏品类资源 |
| **神魂** | 顶级藏品获取 | 觉醒仪式 |

### 3.2 角色系统（10-16 英雄）

```
老板的 11 张英雄立绘：
1. 王子（主角/质量 5）        → 攻击 150, 暴击 20%
2. 骑士              → 攻击 130, 生命 +30%
3. 法师              → 攻击 120, 群攻
4. 弓箭手            → 攻击 110, 远程
5. 刺客              → 攻击 100, 先手
6. 祭司              → 治疗
7. 圣骑士            → 团队护盾
8. 德鲁伊            → 自然系
9. 吟游诗人          → 辅助
10. 武僧            → 反击
11. 召唤师            → 召唤

老板每集 11 张怪物立绘：
- 第 1 章 觉醒之路：5 张
- 第 2 章 王座争夺：5 张
- 第 3 章 深渊试炼：5 张
- 第 4 章 光之觉醒：5 张
```

### 3.3 战斗系统（回合制 + 800 技能）

```
战斗引擎（保留浅眠核心逻辑 + 新增次神特色）：
- 回合制（保留）：每回合自动出招，按 speed 排序
- 技能组合（新增）：每英雄 80 技能 = 11 × 80 ≈ 880（接近 800）
  - 主动 40（玩家手动释放）
  - 被动 40（触发条件）
- 实时羁绊（次神特色）：2/3/5 英雄触发组合效果
- 战旗站位（保留浅眠）：前/中/后排

技能定义（数据驱动）：
const SKILLS = [
  { hero: 'prince', name: '王威', type: 'active', atk: 1.5x, cooldown: 3, level: 1 },
  { hero: 'prince', name: '继承者', type: 'passive', atk_bonus: 30, level: 1 },
  ...
];
```

### 3.4 挂机系统（次神核心）

```
挂机核心机制：
- 玩家开启「挂机模式」→ 英雄自动打怪
- 每 60 秒触发一次战斗回合
- 离线也累计（最多 8 小时）
- 挂机收益 = 战斗收益 × 1.5（10x 离线采集）

挂机收益结算：
- 在线 1 小时：50 灵石 + 30 灵气 + 5 进阶石 + 1 神药（保底）
- 离线 8 小时：400 灵石 + 240 灵气 + 40 进阶石 + 8 神药（保底）

挂机可视化：
- 主城页大按钮「挂机中/已暂停」
- 英雄列表显示"自动战斗"小图标
- BOSS 战特殊：需要手动点确认（保留趣味性）
```

### 3.5 4 章节剧情（次神特色）

```
章节 1：觉醒之路（50 关）
- 主线：王子发现身世 + 第一段羁绊
- BOSS：shadow_king（影之王）/ 老板的 shadow_king.png 立绘
- 决策点：3 处（影响后续剧情走向）

章节 2：王座争夺（50 关）
- 主线：王子继承王位 + 王国纷争
- BOSS：iron_emperor（铁之王）
- 解锁：藏品系统（死神餐刀 +20% 攻击）

章节 3：深渊试炼（50 关）
- 主线：黑暗深渊 + 守护者试炼
- BOSS：abyss_lord（深渊领主）
- 解锁：羁绊系统 3 人组

章节 4：光之觉醒（50 关）
- 主线：最终之战 + 王子成神
- BOSS：final_prince（最终君主/终极王子）
- 解锁：800 技能全开 + 永恒称号

每章通关奖励：
- 1 抽十连券 ×10（关卡宝箱）
- 10000 灵石（章节完成）
- 1 件专属藏品
```

### 3.6 藏品系统（次神特色）

```
藏品类型（老板可自由扩展）：
- 餐具类：死神餐刀（攻击+20%）、金饭碗（金币+30%）
- 雕像类：胜利女神像（暴击+15%）
- 面具类：风之面具（闪避+30%）

获取：剧情解锁 / BOSS 掉落 / 成就奖励

每件藏品：
- 等级：1-10（升级用精魄）
- 加成：可叠加（按乘法计算）
- 收藏完成度：影响剧情分支
```

### 3.7 羁绊系统（次神特色）

```
10-16 英雄 → 50+ 条羁绊：

2 人羁绊：王子 + 骑士（"兄弟情深"）→ 攻击+10%
3 人羁绊：王子 + 骑士 + 圣骑士（"王国铁三角"）→ 生命+25%
5 人羁绊：王子 + 骑士 + 法师 + 弓箭手 + 圣骑士（"光之五重奏"）→ 全属性+30%

羁绊解锁条件：英雄同时上阵
羁绊激活效果：显示在主城羁绊列表
```

---

## 四、D1 数据库 Schema（v1.0）

### 4.1 表清单（13 张）

```sql
-- 用户表（保留浅眠 users 结构）
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 玩家表（核心）
CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    gender INTEGER DEFAULT 0,
    realm_level INTEGER DEFAULT 1,
    realm_xp INTEGER DEFAULT 0,
    ling_stone INTEGER DEFAULT 500,
    spirit INTEGER DEFAULT 100,
    exp INTEGER DEFAULT 0,
    current_stage INTEGER DEFAULT 1,
    max_stage INTEGER DEFAULT 0,
    gongxun INTEGER DEFAULT 0,             -- 功勋货币
    gongxun_total INTEGER DEFAULT 0,
    awakens INTEGER DEFAULT 0,            -- 觉醒（次神特色）
    chapter_cleared INTEGER DEFAULT 0,
    campaign_progress INTEGER DEFAULT 0,
    mine_level INTEGER DEFAULT 0,         -- 矿洞等级
    goblin_level INTEGER DEFAULT 0,       -- 哥布林村庄等级
    artifact_level INTEGER DEFAULT 0,     -- 神灯等级
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_collect TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 英雄表
CREATE TABLE heroes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    hero_key TEXT NOT NULL,              -- 'prince', 'knight' 等
    quality INTEGER NOT NULL,             -- 1白 2蓝 3紫 4金 5红
    star INTEGER DEFAULT 0,               -- 升星 0-5
    level INTEGER DEFAULT 1,               -- 等级 1-100
    slot INTEGER DEFAULT -1,               -- 上阵槽 -1=未上阵 0~4=前中/后排
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 武器表
CREATE TABLE weapons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    quality INTEGER NOT NULL,
    grade INTEGER DEFAULT 1,
    equipped_hero_id INTEGER,             -- 装备给哪个英雄
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 物品表
CREATE TABLE player_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    item_key TEXT NOT NULL,
    qty INTEGER DEFAULT 1,
    UNIQUE (player_id, item_key),
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 战斗日志表
CREATE TABLE battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    chapter INTEGER DEFAULT 1,
    stage INTEGER NOT NULL,
    result TEXT NOT NULL,                  -- 'win' or 'lose'
    rounds INTEGER,
    rewards_json TEXT,                    -- {exp, spirit, ling, items}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 任务完成日志（每日任务 + 终身成就）
CREATE TABLE task_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    task_key TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    target INTEGER NOT NULL,
    completed_at TIMESTAMP,
    claimed_at TIMESTAMP,
    day_date DATE,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 藏品
CREATE TABLE artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    artifact_key TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (player_id, artifact_key),
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 羁绊
CREATE TABLE bonds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    bond_key TEXT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (player_id, bond_key),
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 章节进度
CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL,
    cleared_stage INTEGER DEFAULT 0,
    boss_cleared INTEGER DEFAULT 0,
    story_branch TEXT,                    -- 决策点选择的分支
    UNIQUE (player_id, chapter_id),
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 离线收益记录
CREATE TABLE afk_collects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    collect_amount INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    rewards_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 购物记录
CREATE TABLE shop_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    item_key TEXT NOT NULL,
    qty INTEGER DEFAULT 1,
    cost INTEGER NOT NULL,
    period TEXT NOT NULL,                  -- 'daily', 'weekly', 'lifetime'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 模板数据（11 英雄/11 怪物/8 商品/4 章节）
-- 通过 wrangler d1 seed 执行
```

### 4.2 D1 模板 seed 数据

```sql
-- 11 英雄模板
INSERT INTO heroes (player_id, hero_key, quality, level) VALUES
  (0, 'prince', 5, 1), (0, 'knight', 4, 1), (0, 'mage', 4, 1),
  (0, 'archer', 3, 1), (0, 'assassin', 3, 1), (0, 'priest', 2, 1),
  (0, 'paladin', 5, 1), (0, 'druid', 2, 1), (0, 'bard', 2, 1),
  (0, 'monk', 3, 1), (0, 'summoner', 4, 1);

-- 4 章节 + BOSS
INSERT INTO chapters (chapter_id, name, stages, boss_key) VALUES
  (1, '觉醒之路', 50, 'shadow_king'),
  (2, '王座争夺', 50, 'iron_emperor'),
  (3, '深渊试炼', 50, 'abyss_lord'),
  (4, '光之觉醒', 50, 'final_prince');

-- 8 商品
INSERT INTO shop_items (item_key, name, cost, period, limit, type) VALUES
  ('summon_1', '按加成券', 30, 'daily', '5', 'free_summon_1'),
  ('summon_10', '十连券', 250, 'weekly', '1', 'free_summon_10'),
  ('artifact_piece', '藏品碎片', 50, 'weekly', '3', 'item'),
  ('revive_token', '复活符', 15, 'daily', '10', 'item'),
  ('god_pill', '神药', 80, 'daily', '2', 'item'),
  ('ling_stone_1000', '1000灵石', 20, 'daily', '3', 'ling'),
  ('artifact_token_10', '精魂×10', 60, 'weekly', '5', 'artifact_token'),
  ('title_legend', '称号·传说', 500, 'lifetime', '1', 'title');
```

---

## 五、工作量 + 时间线

| 阶段 | 内容 | 工作量 |
|------|------|------|
| **Phase 0：基础设施** | Cloudflare 账号 + wrangler 安装 + D1 + Pages + Workers + R2 创建 | 0.5 天 |
| **Phase 1：核心移植** | 浅眠战斗引擎 → JS/TS 重写 + 11 英雄池 + 4 章节 + D1 schema + seed | 5 天 |
| **Phase 2：核心新增** | 挂机系统 + 羁绊 + 800 技能 + 4 章节剧情 | 5 天 |
| **Phase 3：次神特色** | 藏品 + 矿洞 + 神灯 + 哥布林村庄 + 决策点剧情 | 3 天 |
| **Phase 4：单人模式** | 关停社交 + 关闭双服 + 本地存档导出 | 1 天 |
| **Phase 5：测试打磨** | 4 章节通关 + 挂机平衡 + 11 美术接入 | 3 天 |
| **总计** | | **约 18 天（4 周）** |

---

## 六、风险 + 缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| **D1 SQL 兼容** | 🟢 低 | 80% SQL 通用；少数函数（DATE_FORMAT、GROUP_CONCAT）需替换为 SQLite 版本 |
| **Workers CPU 10ms 限制** | 🟡 中 | 战斗计算 / 挂机结算拆批；D1 写慢 → 用 batch + 缓存 |
| **老板美术上传** | 🟢 低 | R2 上传一次（不重复）；前端 CDN 缓存 |
| **800 技能组合爆炸** | 🟢 低 | 数据驱动配置 + JSON 模板生成器 |
| **迁移到独立服务器** | 🟢 低 | D1 数据可导出 SQL → 转到 VPS MySQL；Workers 改 Node.js 服务 |
| **GitHub Action 自动部署** | 🟢 低 | Pages 自动（git push → 部署）；Workers 自动 |

---

## 七、老板下一步

老板拍板后，我会做的事：

1. **Phase 0** 立即开工（建 Cloudflare 资源 + D1 + Pages + Workers + GitHub 仓库）
2. **Phase 1** 战斗引擎 + D1 schema（关键基础）
3. **Phase 2** 挂机 + 技能 + 章节（核心体验）

老板需要确认：
1. **老板的 Cloudflare 账号**（或我创建 bengom 账号）
2. **GitHub 仓库名**（老板在 github.com 的 bengom 账号下创建）
3. **老板的 11 张英雄立绘 + 11 张怪物立绘**（美术上传到 public/assets/heroes/）
4. **战斗平衡参数**（次神风：灵石/灵气/进阶石的比例，可参照浅眠）

---

## 八、老板决策（2026-10-06 21:18）

| 维度 | 决策 |
|------|------|
| 后端语言 | **TypeScript**（老板同意推荐） |
| 前端框架 | **Vue 3**（老板同意推荐） |
| 登录方式 | ~~Magic-Link~~ → **邮箱密码**（老板问 Magic-Link 是啥，单人玩改用简单密码即可） |

### 8.1 Magic-Link vs 邮箱密码对比

| 维度 | Magic-Link | 邮箱密码 |
|------|------------|----------|
| 实现难度 | 🟡 中（要 SMTP） | 🟢 低（10 行代码） |
| 需要邮箱配置 | ✅ 必须 | ❌ 不需要 |
| 适用场景 | 多人产品（避免用户记密码） | **单人玩 / 内部工具** |
| 密码安全 | 不需要记密码 | 需用 hash 加密（bcrypt） |
| 第三方依赖 | Resend/Postmark/SendGrid | 无 |
| **推荐（单人玩）** | ❌ | ✅ |

**老板决策** —— Magic-Link 是无密码登录（输入邮箱 → 收邮件点链接 → 自动登录），需要 SMTP 服务支持（Resend/Postmark/SendGrid 等）。**单人玩场景用邮箱密码就够**，不需引入邮件依赖。

### 8.2 Phase 0 立即开工清单

```bash
# Phase 0：0.5 天
[ ] 老板注册 Cloudflare 账号（或用现有）
[ ] wrangler 装 npm install -g wrangler
[ ] wrangler login（授权）
[ ] 创建 D1 数据库：wrangler d1 create wake-game-db
[ ] 创建 Pages 项目：wrangler pages project create wake-game
[ ] 创建 R2 存储桶：wrangler r2 bucket create wake-game-assets
[ ] 创建 GitHub 仓库（bengom/wake-game）
[ ] wrangler init 初始化项目
```

