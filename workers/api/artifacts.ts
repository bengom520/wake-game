/**
 * API: 藏品（列表 / 升级）
 */
import { Hono } from 'hono';
import type { Env, Vars, Artifact } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail, casDeduct } from '../lib/helpers';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface ArtifactTpl {
  key: string; name: string; type: string; effect: string; chapter: number; img: string;
}

// GET /api/artifacts 藏品列表
app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const owned = await c.env.DB.prepare(
    'SELECT * FROM artifacts WHERE player_id = ? ORDER BY acquired_at DESC'
  ).bind(pid).all<Artifact>();

  const tpl = await getTemplate<ArtifactTpl[]>(c, 'artifacts', []);

  const list = tpl.map(t => {
    const o = (owned.results ?? []).find(x => x.artifact_key === t.key);
    return {
      ...t,
      owned: !!o,
      level: o?.level ?? 0,
    };
  });

  return ok(c, { artifacts: list });
});

// POST /api/artifacts/upgrade { key } 升级（消耗灵石 + 精魄）
app.post('/upgrade', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const body = await c.req.json<{ key: string }>();
  const tpl = await getTemplate<ArtifactTpl[]>(c, 'artifacts', []);
  const t = tpl.find(x => x.key === body.key);
  if (!t) return fail(c, '藏品不存在');

  const owned = await c.env.DB.prepare(
    'SELECT * FROM artifacts WHERE player_id = ? AND artifact_key = ?'
  ).bind(pid, body.key).first<Artifact>();
  if (!owned) return fail(c, '尚未拥有此藏品');
  if (owned.level >= 10) return fail(c, '已达满级 10');

  const cost = owned.level * 100 + 50;
  const paid = await casDeduct(c, 'ling_stone', cost, pid);
  if (!paid) return fail(c, `灵石不足（需 ${cost}）`);

  await c.env.DB.prepare(
    'UPDATE artifacts SET level = level + 1 WHERE id = ?'
  ).bind(owned.id).run();

  return ok(c, { msg: `${t.name} 升级到 Lv.${owned.level + 1}`, cost, new_level: owned.level + 1 });
});

export default app;
