/**
 * API: 章节（列表 + Boss 挑战）
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail } from '../lib/helpers';
import { generateEnemy, heroToCombatant, runBattle, stageConfig } from '../lib/battle';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// GET /api/chapters 章节列表 + 进度
app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const tpl = await getTemplate<any[]>(c, 'chapters', []);
  const prog = await c.env.DB.prepare(
    'SELECT * FROM chapters WHERE player_id = ? ORDER BY chapter_id'
  ).bind(pid).all();

  return ok(c, {
    chapters: tpl.map((ct: any) => {
      const p = (prog.results ?? []).find((x: any) => x.chapter_id === ct.id);
      return { ...ct, cleared_stage: p?.cleared_stage ?? 0, boss_cleared: p?.boss_cleared ?? 0 };
    }),
  });
});

// POST /api/chapters/boss { chapter } Boss 挑战
app.post('/boss', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const body = await c.req.json<{ chapter: number }>();
  const chapter = Math.max(1, Math.min(4, Number(body.chapter) || 1));

  // 校验：必须清完 50 关才能打 Boss
  const chProg = await c.env.DB.prepare(
    'SELECT * FROM chapters WHERE player_id = ? AND chapter_id = ?'
  ).bind(pid, chapter).first<{ cleared_stage: number; boss_cleared: number }>();
  if (!chProg || chProg.cleared_stage < 50) {
    return fail(c, '请先通关本章节 50 关');
  }
  if (chProg.boss_cleared) return fail(c, 'Boss 已被击败');

  // 上阵英雄
  const heroes = await c.env.DB.prepare(
    'SELECT * FROM heroes WHERE player_id = ? AND slot >= 0 ORDER BY slot'
  ).bind(pid).all();
  if (!heroes.results || heroes.results.length === 0) return fail(c, '请先上阵英雄');

  const heroTpl = await getTemplate<any[]>(c, 'heroes', []);
  const team = (heroes.results as any[]).map((h: any) => {
    const t = heroTpl.find((x: any) => x.key === h.hero_key);
    return heroToCombatant({
      key: h.hero_key, name: t?.name ?? h.hero_key,
      level: h.level, quality: h.quality,
      base_attack: t?.attack ?? 100, hp_mult: t?.hp ?? 1.0,
    });
  });

  // Boss 属性（比普通怪强 5 倍）
  const cfg = stageConfig(chapter, 50);
  const bossCfg = {
    ...cfg,
    enemyName: `Boss·${['影之王','铁之王','深渊领主','最终君主'][chapter-1]}`,
    enemyHp: Math.round(cfg.enemyHp * 5),
    enemyAtk: Math.round(cfg.enemyAtk * 2),
    enemyDef: Math.round(cfg.enemyDef * 2),
    maxRounds: 50,
  };
  const enemy = generateEnemy(bossCfg);
  const result = runBattle(team, enemy, 50);

  if (result.win) {
    await c.env.DB.prepare(
      'UPDATE chapters SET boss_cleared = 1 WHERE player_id = ? AND chapter_id = ?'
    ).bind(pid, chapter).run();

    // 发藏品
    const artifactKeys = ['awaken_blade','iron_crown','abyss_eye','light_seal'];
    const aKey = artifactKeys[chapter - 1];
    await c.env.DB.prepare(
      'INSERT INTO artifacts (player_id, artifact_key) VALUES (?, ?) ' +
      'ON CONFLICT(player_id, artifact_key) DO NOTHING'
    ).bind(pid, aKey).run();

    return ok(c, { win: true, log: result.log, reward: `击败 Boss！获得藏品 ×1` });
  }

  return ok(c, { win: false, log: result.log, reward: '' });
});

export default app;
