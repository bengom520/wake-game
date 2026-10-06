# 修仙：挂机觉醒 v1.0

> 次神：光之觉醒风格 × 仙侠主题 · Cloudflare 全栈（Pages + Workers + D1）
> 单人本地玩模式，未来可迁独立服务器多人化

## 快速开始

**给 AI Agent（豆包）的完整部署指令见：[`DEPLOY_INSTRUCTIONS.md`](./DEPLOY_INSTRUCTIONS.md)**

人类快速版：
```bash
npm install -g wrangler
wrangler login
wrangler d1 create wake-game-db           # 把返回的 database_id 填进 wrangler.toml
wrangler r2 bucket create wake-game-assets
wrangler kv namespace create wake-cache   # 把返回的 id 填进 wrangler.toml
wrangler d1 execute wake-game-db --remote --file=workers/db/schema.sql
wrangler d1 execute wake-game-db --remote --file=workers/db/seed.sql
npm install && wrangler deploy
wrangler pages project create wake-game
wrangler pages deploy public --project-name=wake-game
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3（CDN 全局版，免 build）+ 原生 CSS |
| 后端 | Cloudflare Workers + Hono + TypeScript |
| 数据库 | Cloudflare D1（SQLite） |
| 存储 | Cloudflare R2（美术资源） |
| 缓存 | Cloudflare KV |
| 认证 | PBKDF2 密码哈希 + HttpOnly Cookie Session |

## 目录结构

```
wake-cloudflare/
├── wrangler.toml           Cloudflare 配置
├── workers/                后端（Workers）
│   ├── index.ts            入口
│   ├── lib/                引擎 + helper
│   ├── db/                 schema.sql + seed.sql
│   └── api/                11 个 API 模块
├── public/                 前端（Pages）
│   ├── index.html
│   ├── css/theme.css
│   └── js/                 api.js + main.js
└── .github/workflows/      自动部署
```

## 核心玩法（次神风）

- **挂机放置**：离线最多累计 8 小时收益
- **回合制战斗**：5 人上阵，按 speed 排序出手，暴击/减伤计算
- **4 章节剧情**：觉醒之路 / 王座争夺 / 深渊试炼 / 光之觉醒（每章 50 关 + BOSS）
- **11 英雄**：王子/骑士/法师/弓箭手/刺客/祭司/圣骑士/德鲁伊/吟游诗人/武僧/召唤师
- **6 羁绊**：2/3/5 人组合触发属性加成
- **8 藏品**：死神餐刀（攻击+20%）/金饭碗（灵石+30%）等
- **8 每日任务** + **8 商品功勋商店**（含限购）

## 当前实现状态

| 模块 | 状态 |
|---|---|
| 注册/登录/登出 | ✅ 完成 |
| 主城面板 | ✅ 完成 |
| 闯关战斗 | ✅ 完成 |
| 挂机离线收益 | ✅ 完成 |
| 英雄养成（升级/升星/上阵） | ⬜ 待实现 |
| 藏品系统 | ⬜ 待实现 |
| 羁绊系统 | ⬜ 待实现 |
| 招募（保底） | ⬜ 待实现 |
| 功勋商店 | ⬜ 待实现 |
| 章节剧情 | ⬜ 待实现 |
| 任务中心 | ⬜ 待实现 |
| 云存档 | ⬜ 待实现 |

## 美术资源待补

老板需要放到 `public/assets/` 下：
- `heroes/01-prince.png` ~ `11-summoner.png`（11 张英雄立绘）
- `chapters/1.png` ~ `4.png`（4 张章节图）
- `bonds/1.png` ~ `6.png`（6 张羁绊图）
- `artifacts/1.png` ~ `8.png`（8 张藏品图）

未放时前端会显示占位图（图片加载失败自动隐藏）。

## 设计稿

完整设计见 [`_design_v1.md`](./_design_v1.md)
