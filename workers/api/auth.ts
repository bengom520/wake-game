/**
 * API: 注册 / 登录 / 登出 / 当前用户
 * 邮箱密码（单人玩简化版，无邮箱验证）
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import {
  hashPassword, verifyPassword, createSession, parseSession,
  getCookie, clearCookie, loadPlayer,
} from '../lib/auth';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// 注册
app.post('/register', async (c) => {
  const body = await c.req.json<{ username: string; password: string; nickname?: string }>();
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  const nickname = (body.nickname ?? username).trim();

  if (username.length < 3 || username.length > 20) {
    return c.json({ ok: false, msg: '用户名 3-20 字符' }, 400);
  }
  if (password.length < 6) {
    return c.json({ ok: false, msg: '密码至少 6 位' }, 400);
  }

  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username).first();
  if (exists) return c.json({ ok: false, msg: '用户名已被注册' }, 400);

  const password_hash = await hashPassword(password);
  const now = new Date().toISOString();

  // 事务：建 user + player + 首发 3 白将
  const userId = await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)'
  ).bind(username, password_hash, nickname).run();

  const newUserId = Number(userId.meta.last_row_id ?? 0);
  const playerId = await c.env.DB.prepare(
    'INSERT INTO players (user_id, nickname) VALUES (?, ?)'
  ).bind(newUserId, nickname).run();
  const newPlayerId = Number(playerId.meta.last_row_id ?? 0);

  // 首发 3 白将（prince/knight/archer 品质降到 1）
  for (const [idx, key] of ['prince', 'knight', 'archer'].entries()) {
    await c.env.DB.prepare(
      'INSERT INTO heroes (player_id, hero_key, quality, level, slot) VALUES (?, ?, 1, 1, ?)'
    ).bind(newPlayerId, key, idx === 0 ? 0 : -1).run();
  }

  const token = createSession({
    user_id: newUserId, username, player_id: newPlayerId,
    exp: Date.now() + 30 * 24 * 3600 * 1000,
  });
  c.header('Set-Cookie', getCookie(token));

  return c.json({ ok: true, msg: '注册成功', player_id: newPlayerId });
});

// 登录
app.post('/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>();
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE username = ?'
  ).bind(username).first<{ id: number; username: string; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ ok: false, msg: '用户名或密码错误' }, 401);
  }

  const player = await c.env.DB.prepare(
    'SELECT id FROM players WHERE user_id = ?'
  ).bind(user.id).first<{ id: number }>();
  if (!player) return c.json({ ok: false, msg: '玩家数据缺失' }, 500);

  const token = createSession({
    user_id: user.id, username: user.username, player_id: player.id,
    exp: Date.now() + 30 * 24 * 3600 * 1000,
  });
  c.header('Set-Cookie', getCookie(token));

  return c.json({ ok: true, msg: '登录成功', player_id: player.id });
});

// 登出
app.post('/logout', (c) => {
  c.header('Set-Cookie', clearCookie());
  return c.json({ ok: true, msg: '已登出' });
});

// 当前用户
app.get('/me', async (c) => {
  const cookie = c.req.header('Cookie') ?? '';
  const match = cookie.match(/wake_session=([^;]+)/);
  if (!match) return c.json({ ok: false, msg: '未登录' }, 401);
  const session = parseSession(match[1]);
  if (!session) return c.json({ ok: false, msg: 'session 无效' }, 401);

  const player = await loadPlayer(c.env.DB, session.player_id);
  if (!player) return c.json({ ok: false, msg: '玩家数据缺失' }, 500);

  return c.json({
    ok: true,
    user: { id: session.user_id, username: session.username },
    player,
  });
});

export default app;
