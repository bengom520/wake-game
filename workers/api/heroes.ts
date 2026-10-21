/**
 * API: 英雄管理（列表 / 上阵 / 升级 / 升星）
 */
import { Hono } from 'hono';
import type { Env, Vars, Hero } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail, casDeduct } from '../lib/helpers';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface HeroTemplate {
  key: string; name: string; quality: number; attack: number;
  hp?: number; role: string; skill: string; img: string;
}

// GET /api/heroes 全列表（含模板合并）
app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const heroes = await c.env.DB.prepare(
    'SELECT * FROM heroes WHERE player_id = ? ORDER BY slot ASC, quality DESC, level DESC'
  ).bind(pid).all<Hero>();

  const tpl = await getTemplate<HeroTemplate[]>(c, 'heroes', []);

  const list = (heroes.results ?? []).map(h => {
    const t = tpl.find(x => x.key === h.hero_key);
    return {
      ...h,
      name: t?.name ?? h.hero_key,
      role: t?.role ?? '未知',
      skill: t?.skill ?? '—',
      base_attack: t?.attack ?? 100,
      hp_mult: t?.hp ?? 1.0,
      img: t?.img ?? '/assets/heroes/placeholder.svg',
    };
  });

  return ok(c, { heroes: list, tpl });
});

// POST /api/heroes/deploy 上阵 { id, slot }
app.post('/deploy', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const body = await c.req.json<{ id: number; slot: number }>();
  const heroId = Number(body.id);
  const slot = Math.max(-1, Math.min(4, Number(body.slot) ?? -1)); // -1=下阵, 0-4=上阵

  // 校验英雄归属
  const hero = await c.env.DB.prepare(
    'SELECT * FROM heroes WHERE id = ? AND player_id = ?'
  ).bind(heroId, pid).first<Hero>();
  if (!hero) return fail(c, '英雄不存在');

  if (slot >= 0) {
    // 同位置先清掉（避免重复上阵）
    await c.env.DB.prepare(
      'UPDATE heroes SET slot = -1 WHERE player_id = ? AND slot = ?'
    ).bind(pid, slot).run();
    // 上阵数量上限 5
    const count = await c.env.DB.prepare(
      'SELECT COUNT(*) as n FROM heroes WHERE player_id = ? AND slot >= 0'
    ).bind(pid).first<{ n: number }>();
    if ((count?.n ?? 0) >= 5) return fail(c, '上阵已满 5 人');
  }

  await c.env.DB.prepare('UPDATE heroes SET slot = ? WHERE id = ? AND player_id = ?')
    .bind(slot, heroId, pid).run();

  return ok(c, { msg: slot >= 0 ? `已上阵到位置 ${slot + 1}` : '已下阵' });
});

// POST /api/heroes/levelup 升级 { id } 消耗灵石
app.post('/levelup', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const body = await c.req.json<{ id: number }>();
  const heroId = Number(body.id);

  const hero = await c.env.DB.prepare(
    'SELECT * FROM heroes WHERE id = ? AND player_id = ?'
  ).bind(heroId, pid).first<Hero>();
  if (!hero) return fail(c, '英雄不存在');

  if (hero.level >= 100) return fail(c, '已达满级 100');

  // 升级成本：当前等级 * 50 灵石
  const cost = hero.level * 50;
  const paid = await casDeduct(c, 'ling_stone', cost, pid);
  if (!paid) return fail(c, `灵石不足（需 ${cost}）`);

  await c.env.DB.prepare('UPDATE heroes SET level = level + 1 WHERE id = ?')
    .bind(heroId).run();

  return ok(c, { msg: `升级到 Lv.${hero.level + 1}`, cost, new_level: hero.level + 1 });
});

// POST /api/heroes/starup 升星 { id } 消耗同名英雄 + 灵石
app.post('/starup', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const body = await c.req.json<{ id: number }>();
  const heroId = Number(body.id);

  const hero = await c.env.DB.prepare(
    'SELECT * FROM heroes WHERE id = ? AND player_id = ?'
  ).bind(heroId, pid).first<Hero>();
  if (!hero) return fail(c, '英雄不存在');
  if (hero.star >= 5) return fail(c, '已达最高星');

  // 升星成本：星数 * 200 灵石
  const cost = hero.star * 200 + 100;
  const paid = await casDeduct(c, 'ling_stone', cost, pid);
  if (!paid) return fail(c, `灵石不足（需 ${cost}）`);

  await c.env.DB.prepare('UPDATE heroes SET star = star + 1 WHERE id = ?')
    .bind(heroId).run();

  return ok(c, { msg: `升星到 ${hero.star + 1}★`, cost, new_star: hero.star + 1 });
});

export default app;
