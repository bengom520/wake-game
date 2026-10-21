/**
 * API: 云台招将（抽卡）
 * 单抽 30 灵石 / 十连 250 灵石，含保底逻辑
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import { requirePlayerId, getTemplate, getMeta, setMeta, ok, fail, casDeduct, addField } from '../lib/helpers';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface HeroTemplate {
  key: string; name: string; quality: number; attack: number;
  hp?: number; role: string; skill: string; img: string;
}
interface SummonCost { hero_ling_1: number; hero_ling_10: number; }
interface PityCfg {
  hero: { purple: number; gold: number; red: number; min_purple: number; min_gold: number };
}

// 随机一个英雄（按品质权重）
function rollHero(tpl: HeroTemplate[], pityCount: number): { key: string; quality: number } {
  // 品质权重：1白40% 2蓝30% 3紫20% 4金8% 5红2%
  // 保底：pityCount >= 50 必金，>= 10 必紫
  const pityGold = pityCount >= 50;
  const pityPurple = pityCount >= 10;

  let quality: number;
  const r = Math.random();
  if (pityGold) quality = 4;
  else if (r < 0.02) quality = 5;
  else if (r < 0.10) quality = 4;
  else if (pityPurple || r < 0.30) quality = 3;
  else if (r < 0.60) quality = 2;
  else quality = 1;

  // 从对应品质池随机
  const pool = tpl.filter(h => h.quality === quality);
  if (pool.length === 0) {
    // 该品质没有，降级
    const fallback = tpl.filter(h => h.quality >= quality - 1);
    const pick = fallback[Math.floor(Math.random() * fallback.length)] || tpl[0];
    return { key: pick.key, quality: pick.quality };
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { key: pick.key, quality: pick.quality };
}

// 单抽
app.post('/single', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const costCfg = await getTemplate<SummonCost>(c, 'summon_cost', {
    hero_ling_1: 30, hero_ling_10: 250,
  });
  const cost = costCfg.hero_ling_1;

  const paid = await casDeduct(c, 'ling_stone', cost, pid);
  if (!paid) return fail(c, `灵石不足（需 ${cost}）`);

  // 读保底计数
  const pityRaw = await getMeta(c, `pity_hero_${pid}`, '0');
  const pityCount = parseInt(pityRaw) || 0;

  const tpl = await getTemplate<HeroTemplate[]>(c, 'heroes', []);
  const { key, quality } = rollHero(tpl, pityCount);

  // 写入英雄（已拥有则升星+1）
  const existing = await c.env.DB.prepare(
    'SELECT * FROM heroes WHERE player_id = ? AND hero_key = ?'
  ).bind(pid, key).first<{ id: number; star: number }>();

  let action: string;
  if (existing) {
    await c.env.DB.prepare('UPDATE heroes SET star = star + 1 WHERE id = ?')
      .bind(existing.id).run();
    action = `已有 ${key}，转化为 ${existing.star + 1}★`;
  } else {
    await c.env.DB.prepare(
      'INSERT INTO heroes (player_id, hero_key, quality, level, slot) VALUES (?, ?, ?, 1, -1)'
    ).bind(pid, key, quality).run();
    action = '新英雄';
  }

  // 更新保底计数
  const newPity = quality >= 4 ? 0 : pityCount + 1;
  await setMeta(c, `pity_hero_${pid}`, String(newPity));

  const heroTpl = tpl.find(t => t.key === key);
  return ok(c, {
    cost, key, quality, name: heroTpl?.name ?? key, action,
    pity_count: newPity,
  });
});

// 十连
app.post('/ten', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const costCfg = await getTemplate<SummonCost>(c, 'summon_cost', {
    hero_ling_1: 30, hero_ling_10: 250,
  });
  const cost = costCfg.hero_ling_10;

  const paid = await casDeduct(c, 'ling_stone', cost, pid);
  if (!paid) return fail(c, `灵石不足（需 ${cost}）`);

  const tpl = await getTemplate<HeroTemplate[]>(c, 'heroes', []);
  let pityCount = parseInt(await getMeta(c, `pity_hero_${pid}`, '0')) || 0;

  const results: { key: string; quality: number; name: string; action: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const { key, quality } = rollHero(tpl, pityCount);
    const existing = await c.env.DB.prepare(
      'SELECT id, star FROM heroes WHERE player_id = ? AND hero_key = ?'
    ).bind(pid, key).first<{ id: number; star: number }>();

    let action: string;
    if (existing) {
      await c.env.DB.prepare('UPDATE heroes SET star = star + 1 WHERE id = ?')
        .bind(existing.id).run();
      action = `重复转 ${existing.star + 1}★`;
    } else {
      await c.env.DB.prepare(
        'INSERT INTO heroes (player_id, hero_key, quality, level, slot) VALUES (?, ?, ?, 1, -1)'
      ).bind(pid, key, quality).run();
      action = '新英雄';
    }

    pityCount = quality >= 4 ? 0 : pityCount + 1;
    const ht = tpl.find(t => t.key === key);
    results.push({ key, quality, name: ht?.name ?? key, action });
  }

  await setMeta(c, `pity_hero_${pid}`, String(pityCount));

  return ok(c, { cost, results, pity_count: pityCount });
});

// GET /api/gacha/info 保底状态 + 价格
app.get('/info', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const costCfg = await getTemplate<SummonCost>(c, 'summon_cost', {
    hero_ling_1: 30, hero_ling_10: 250,
  });
  const pity = parseInt(await getMeta(c, `pity_hero_${pid}`, '0')) || 0;

  const player = await c.env.DB.prepare(
    'SELECT ling_stone FROM players WHERE id = ?'
  ).bind(pid).first<{ ling_stone: number }>();

  return ok(c, {
    cost_single: costCfg.hero_ling_1,
    cost_ten: costCfg.hero_ling_10,
    pity_count: pity,
    ling_stone: player?.ling_stone ?? 0,
  });
});

export default app;
