/**
 * API: 羁绊（列表，已在 game.ts 合并返回，这里只做独立查询）
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail } from '../lib/helpers';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const tpl = await getTemplate<any[]>(c, 'bonds', []);
  const owned = await c.env.DB.prepare(
    'SELECT * FROM bonds WHERE player_id = ?'
  ).bind(pid).all();

  const ownedKeys = new Set((owned.results ?? []).map((x: any) => x.bond_key));

  return ok(c, {
    bonds: tpl.map((b: any) => ({ ...b, owned: ownedKeys.has(b.key) })),
  });
});

export default app;
