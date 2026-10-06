# 🚀 部署指令书（给豆包 AI Agent）

> **老板**：把这个文件的内容复制粘贴给豆包，豆包照着做就能部署。
> **项目**：「修仙：挂机觉醒」v1.0（Cloudflare 全栈）
> **源文件位置**：`D:\workbuddyproject\2026-09-17-09-01-20\wake-cloudflare\`

---

## 📋 豆包任务清单（照单执行）

### 阶段 1：准备（5 分钟）

**请确认以下 3 件事已具备**：
1. ✅ Cloudflare 账号（老板已注册）
2. ✅ GitHub 仓库（老板已创建，名字假设 `wake-game`）
3. ✅ 本地源文件在 `wake-cloudflare/` 目录（含 wrangler.toml / package.json / workers/ / public/）

---

### 阶段 2：创建 Cloudflare 资源（10 分钟）

按顺序执行以下命令，**每一步都要把输出贴给老板确认**：

```bash
# 2.1 安装 wrangler（Cloudflare 官方 CLI）
npm install -g wrangler

# 2.2 登录（老板会给你授权码）
wrangler login

# 2.3 创建 D1 数据库
wrangler d1 create wake-game-db
# ⚠️ 输出里的 database_id 请记录下来

# 2.4 创建 R2 存储桶（美术资源）
wrangler r2 bucket create wake-game-assets

# 2.5 创建 KV 命名空间（缓存）
wrangler kv namespace create wake-cache
# ⚠️ 输出里的 id 请记录下来
```

**豆包必须做的事**：
- 把 2.3 的 `database_id` 填进 `wrangler.toml` 的 `REPLACE_WITH_REAL_DB_ID`
- 把 2.5 的 `id` 填进 `wrangler.toml` 的 `REPLACE_WITH_REAL_KV_ID`

---

### 阶段 3：数据库初始化（5 分钟）

```bash
# 3.1 建表（13 张表）
wrangler d1 execute wake-game-db --remote --file=workers/db/schema.sql

# 3.2 灌种子数据（11 英雄 / 4 章节 / 8 商品 / 6 羁绊 / 8 藏品 / 8 每日任务）
wrangler d1 execute wake-game-db --remote --file=workers/db/seed.sql

# 3.3 验证（应该返回 13 张表）
wrangler d1 execute wake-game-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

⚠️ **注意**：3.1 用 `execute` 而不是 `migrations apply`（因为 schema.sql 已经用 `IF NOT EXISTS` 幂等设计）。如果老板想用标准 migrations，告诉我，我改成 migration 文件格式。

---

### 阶段 4：部署后端 Workers（3 分钟）

```bash
# 4.1 安装依赖
npm install

# 4.2 类型检查（可选，确认没语法错）
npx tsc --noEmit

# 4.3 部署
wrangler deploy

# 4.4 测试
curl https://wake-game.bengom.workers.dev/health
# 期望输出：{"status":"ok","title":"修仙：挂机觉醒","version":"v1.0.0","mode":"single_player"}
```

⚠️ **如果 4.4 报路由错**：说明 `wrangler.toml` 里的 `[env.production]` 配置有问题（绑了自定义域名 `api.wake-game.bengom.com`），改回 `workers_dev = true` 就能拿到 `*.workers.dev` 地址。

---

### 阶段 5：部署前端 Pages（3 分钟）

```bash
# 5.1 创建 Pages 项目
wrangler pages project create wake-game

# 5.2 部署 public/ 目录
wrangler pages deploy public --project-name=wake-game

# 5.3 输出会是 https://xxxx.wake-game.pages.dev
```

⚠️ **关键一步**：部署完后要改 `public/js/api.js` 里的 `API_BASE` 为真实的 Workers 地址，然后**重新部署一次前端**。

---

### 阶段 6：GitHub 自动部署（可选，10 分钟）

如果老板想以后 `git push` 就自动部署：

1. GitHub 仓库 → Settings → Secrets and variables → Actions
2. 新建 2 个 secret：
   - `CLOUDFLARE_API_TOKEN`（Cloudflare 右上角 → My Profile → API Tokens → Create Token → 模板选 "Edit Cloudflare Workers"）
   - `CLOUDFLARE_ACCOUNT_ID`（Cloudflare 右侧栏能看到）
3. 把 `wake-cloudflare/` 全部文件 push 到 GitHub 仓库 main 分支
4. 以后每次 push 都会自动跑 `.github/workflows/deploy.yml`

---

## 📁 项目文件清单（告诉豆包这些是什么）

```
wake-cloudflare/
├── wrangler.toml                 # Cloudflare 配置（D1/KV/R2 绑定 + 环境变量）
├── package.json                  # 依赖 + 脚本
├── tsconfig.json                 # TypeScript 配置
├── .github/workflows/deploy.yml  # GitHub Actions 自动部署
├── workers/
│   ├── index.ts                  # Workers 入口（Hono 路由分发）
│   ├── lib/
│   │   ├── types.ts              # 类型定义 + Env 绑定
│   │   ├── auth.ts               # PBKDF2 密码 + session cookie
│   │   ├── helpers.ts            # 通用 helper（CAS 扣货币 / 模板读取）
│   │   └── battle.ts             # 回合制战斗引擎（纯 TS）
│   ├── db/
│   │   ├── schema.sql            # 13 张表 DDL
│   │   └── seed.sql              # 种子数据（英雄/章节/羁绊/藏品/商店/任务）
│   └── api/
│       ├── auth.ts               # ✅ 已实现：注册/登录/登出/me
│       ├── game.ts               # ✅ 已实现：主城全量数据
│       ├── battle.ts             # ✅ 已实现：闯关战斗（服务端结算）
│       ├── afk.ts                # ✅ 已实现：挂机/离线收益（8h 上限）
│       ├── heroes.ts             # ⬜ TODO：英雄养成（升级/升星/上阵/技能）
│       ├── artifacts.ts          # ⬜ TODO：藏品系统
│       ├── bonds.ts              # ⬜ TODO：羁绊系统
│       ├── shop.ts               # ⬜ TODO：功勋商店（8 商品 + 限购）
│       ├── chapters.ts           # ⬜ TODO：4 章节剧情
│       ├── tasks.ts              # ⬜ TODO：任务中心（8 每日 + 21 成就）
│       └── save.ts               # ⬜ TODO：云存档导出/导入
└── public/
    ├── index.html                # 入口（Vue 3 CDN 版，免 build）
    ├── css/theme.css             # 仙侠主题
    ├── js/
    │   ├── api.js                # API client（改 API_BASE 指向 Workers）
    │   └── main.js               # Vue 3 应用（登录/主城/战斗三页）
    └── assets/
        ├── heroes/               # ⬜ 老板放 11 张英雄立绘
        ├── chapters/             # ⬜ 老板放 4 张章节图
        ├── bonds/                # ⬜ 6 张羁绊图
        └── artifacts/            # ⬜ 8 张藏品图
```

---

## ⚠️ 常见问题（豆包遇到别慌）

| 症状 | 原因 | 解决 |
|---|---|---|
| `wrangler login` 打开浏览器无反应 | 沙箱环境 | 用 `CLOUDFLARE_API_TOKEN` 环境变量代替（阶段 6 说的 token） |
| `d1 execute` 报 `no such table` | 顺序错了 | 先 3.1 建表（schema.sql）再 3.2 灌数据（seed.sql） |
| Workers 部署成功但 `/health` 404 | `[env.production]` 绑了域名 | 改 `workers_dev = true` 并删掉 `[env.production]` 段 |
| 前端调 API 报 CORS | Workers 没配 CORS | `workers/index.ts` 已配 `hono/cors`，检查前端域名是否在白名单 |
| 前端白屏 | Vue CDN 没加载 | 检查网络能否访问 unpkg.com（或改成 jsdelivr） |
| 战斗一直失败 | 英雄没上阵 | 主城提示"尚未上阵"，需要先实现 `heroes.ts` 的上阵功能 |

---

## 🎯 MVP 验收标准

部署完成后，豆包要能跑通这 4 步：

1. 打开前端 → 看到「修仙：挂机觉醒」登录页
2. 注册账号 `bengom` / 密码 `123456` → 自动进主城
3. 主城看到 3 个首发白将（王子/骑士/弓箭手）+ 4 章节 + 6 羁绊（都未激活）
4. 切到「挂机领取」→ 提示"挂机时间不足 1 分钟"（正常，因为刚创建）

**注意**：第 4 步之后暂时无法战斗，因为「上阵英雄」功能在 `heroes.ts`（TODO）里。让豆包先把 `heroes.ts` 的上阵功能补上（POST /api/heroes/team 上阵），才能测试战斗。

---

## 📮 联系

遇到问题让豆包反馈具体报错信息，我（小彬）来修。
