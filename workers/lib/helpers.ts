/**
 * 通用 API helper：统一 auth 校验 + 模板数据读取 + JSON 响应
 */
import type { Context } from 'hono';
import type { Env, Vars } from './types';
import { parseSession } from './auth';

type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

/** 从 cookie 解析当前玩家 ID，失败返回 null */
export async function requirePlayerId(c: Ctx): Promise<number | null> {
  const cookie = c.req.header('Cookie') ?? '';
  const match = cookie.match(/wake_session=([^;]+)/);
  if (!match) return null;
  const session = parseSession(match[1]);
  if (!session || session.exp < Date.now()) return null;
  return session.player_id;
}

/** 读取 site_meta 里的模板 JSON */
export async function getTemplate<T>(c: Ctx, key: string, fallback: T): Promise<T> {
  const row = await c.env.DB.prepare('SELECT mval FROM site_meta WHERE mkey = ?')
    .bind(`template:${key}`).first<{ mval: string }>();
  if (!row) return fallback;
  try {
    return JSON.parse(row.mval) as T;
  } catch {
    return fallback;
  }
}

/** 更新 site_meta */
export async function setMeta(c: Ctx, key: string, val: string) {
  await c.env.DB.prepare(
    'INSERT INTO site_meta (mkey, mval, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ' +
    'ON CONFLICT(mkey) DO UPDATE SET mval = excluded.mval, updated_at = CURRENT_TIMESTAMP'
  ).bind(key, val).run();
}

/** 读取 site_meta */
export async function getMeta(c: Ctx, key: string, def = '0'): Promise<string> {
  const row = await c.env.DB.prepare('SELECT mval FROM site_meta WHERE mkey = ?')
    .bind(key).first<{ mval: string }>();
  return row?.mval ?? def;
}

/** 扣减货币（CAS 原子扣，防并发双扣） */
export async function casDeduct(
  c: Ctx, field: 'ling_stone' | 'spirit' | 'gongxun' | 'exp' | 'realm_xp',
  amount: number, playerId: number
): Promise<boolean> {
  if (amount <= 0) return true;
  const r = await c.env.DB.prepare(
    `UPDATE players SET ${field} = ${field} - ? WHERE id = ? AND ${field} >= ?`
  ).bind(amount, playerId, amount).run();
  return (r.meta.changes ?? 0) > 0;
}

/** 增加货币 */
export async function addField(
  c: Ctx, field: 'ling_stone' | 'spirit' | 'gongxun' | 'gongxun_total' | 'exp' | 'realm_xp',
  amount: number, playerId: number
): Promise<void> {
  if (amount === 0) return;
  await c.env.DB.prepare(
    `UPDATE players SET ${field} = ${field} + ? WHERE id = ?`
  ).bind(amount, playerId).run();
}

/** 通用成功/失败响应 */
export const ok = (c: Ctx, data: Record<string, unknown> = {}) =>
  c.json({ ok: true, ...data });
export const fail = (c: Ctx, msg: string, code = 400) =>
  c.json({ ok: false, msg }, code as 400);
