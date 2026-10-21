/**
 * API: 存档（手动保存 / 读取进度）
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import { requirePlayerId, ok, fail } from '../lib/helpers';
import { loadPlayer } from '../lib/auth';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/save 全量存档
app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const player = await loadPlayer(c.env.DB, pid);
  if (!player) return fail(c, '玩家数据缺失', 500);

  const heroes = await c.env.DB.prepare('SELECT * FROM heroes WHERE player_id = ?').bind(pid).all();
  const artifacts = await c.env.DB.prepare('SELECT * FROM artifacts WHERE player_id = ?').bind(pid).all();
  const items = await c.env.DB.prepare('SELECT * FROM player_items WHERE player_id = ?').bind(pid).all();

  return ok(c, {
    player,
    heroes: heroes.results,
    artifacts: artifacts.results,
    items: items.results,
    saved_at: new Date().toISOString(),
  });
});

// POST /api/save 手动保存（D1 已实时写入，这里只返回确认）
app.post('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);
  return ok(c, { msg: '存档已保存（D1 实时持久化）', saved_at: new Date().toISOString() });
});

export default app;
