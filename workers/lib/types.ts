/**
 * Cloudflare Workers 环境绑定类型
 */
export interface Env {
  DB: D1Database;              // D1 数据库
  ASSETS: R2Bucket;            // R2 美术资源存储
  CACHE: KVNamespace;          // KV 缓存（hot data）
  GAME_TITLE: string;
  GAME_VERSION: string;
  GAME_DAY_MODE: string;
  JWT_SECRET?: string;         // 环境变量注入
}

export interface Vars {
  user: {
    id: number;
    username: string;
    player_id: number;
  };
}

/**
 * 数据库表类型
 */
export interface User {
  id: number;
  username: string;
  password_hash: string;
  nickname: string;
  is_admin: number;
  created_at: string;
}

export interface Player {
  id: number;
  user_id: number;
  nickname: string;
  gender: number;
  realm_level: number;
  realm_xp: number;
  ling_stone: number;
  spirit: number;
  exp: number;
  current_stage: number;
  max_stage: number;
  gongxun: number;
  gongxun_total: number;
  awakens: number;
  chapter_cleared: number;
  campaign_progress: number;
  mine_level: number;
  goblin_level: number;
  artifact_level: number;
  created_at: string;
  last_collect: string;
}

export interface Hero {
  id: number;
  player_id: number;
  hero_key: string;
  quality: number;
  star: number;
  level: number;
  slot: number;
}

export interface Weapon {
  id: number;
  player_id: number;
  name: string;
  quality: number;
  grade: number;
  equipped_hero_id: number | null;
}

export interface Artifact {
  id: number;
  player_id: number;
  artifact_key: string;
  level: number;
  acquired_at: string;
}

export interface Bond {
  id: number;
  player_id: number;
  bond_key: string;
  unlocked_at: string;
}

export interface Chapter {
  id: number;
  player_id: number;
  chapter_id: number;
  cleared_stage: number;
  boss_cleared: number;
  story_branch: string | null;
}

export interface TaskLog {
  id: number;
  player_id: number;
  task_key: string;
  progress: number;
  target: number;
  completed_at: string | null;
  claimed_at: string | null;
  day_date: string | null;
}

/**
 * 战斗结果
 */
export interface BattleResult {
  ok: boolean;
  win: boolean;
  rewards: {
    exp: number;
    spirit: number;
    ling: number;
    items?: { key: string; qty: number }[];
  };
  log: string[];
}
