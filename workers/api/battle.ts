/**
 * API: 战斗（闯关 / BOSS）
 * 服务端权威结算（防作弊）
 */
import { Hono } from 'hono';
import type { Env, Vars, Hero } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail, addField, casDeduct } from '../lib/helpers';
import { generateEnemy, heroToCombatant, runBattle, stageConfig } from '../lib/battle';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface BattleRewardCfg {
  ling_min: number; ling_max: number;
  exp_base: number; exp_mult: number;
  spirit_base: number; spirit_mult: number;
}
interface HeroTemplate { key: string; name: string; quality: number; attack: number; hp?: number; role: string; skill: string; img: string; }

// 战斗：POST /api/battle/fight { chapter, stage }
app.post('/fight', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const body = await c.req.json<{ chapter: number; stage: number }>();
  const chapter = Math.max(1, Math.min(4, Number(body.chapter) || 1));
  const stage = Math.max(1, Math.min(50, Number(body.stage) || 1));

  // 章节解锁校验
  const player = await c.env.DB.prepare(
    'SELECT * FROM players WHERE id = ?'
  ).bind(pid).first<{ id: number; current_stage: number; max_stage: number; realm_level: number }>();
  if (!player) return fail(c, '玩家数据缺失', 500);

  // 全局进度 = (chapter-1)*50 + stage；只能打「已通关 +1」的关卡
  const globalStage = (chapter - 1) * 50 + stage;
  const playerMaxGlobal = (chapter - 1) * 50 + (player.max_stage || 0);
  if (globalStage > playerMaxGlobal + 1) {
    return fail(c, '请先通关前面的关卡');
  }

  // 读上阵英雄
  const heroes = await c.env.DB.prepare(
    'SELECT * FROM heroes WHERE player_id = ? AND slot >= 0 ORDER BY slot'
  ).bind(pid).all<Hero>();
  if (!heroes.results || heroes.results.length === 0) {
    return fail(c, '请先在「队伍」页上阵至少 1 名英雄');
  }

  // 合并英雄模板
  const heroTpl = await getTemplate<HeroTemplate[]>(c, 'heroes', []);
  const team = heroes.results.map(h => {
    const tpl = heroTpl.find(t => t.key === h.hero_key);
    return heroToCombatant({
      key: h.hero_key, name: tpl?.name ?? h.hero_key,
      level: h.level, quality: h.quality,
      base_attack: tpl?.attack ?? 100, hp_mult: tpl?.hp ?? 1.0,
    });
  });

  // 生成敌人 + 执行战斗
  const cfg = stageConfig(chapter, stage);
  const enemy = generateEnemy(cfg);
  const result = runBattle(team, enemy, cfg.maxRounds);

  // 奖励
  const rewardCfg = await getTemplate<BattleRewardCfg>(c, 'battle_reward', {
    ling_min: 15, ling_max: 40, exp_base: 20, exp_mult: 1.08,
    spirit_base: 10, spirit_mult: 1.05,
  });
  const ling = Math.round(rewardCfg.ling_min + Math.random() * (rewardCfg.ling_max - rewardCfg.ling_min));
  const exp = Math.round(rewardCfg.exp_base * Math.pow(rewardCfg.exp_mult, globalStage));
  const spirit = Math.round(rewardCfg.spirit_base * Math.pow(rewardCfg.spirit_mult, globalStage));

  if (result.win) {
    await addField(c, 'ling_stone', ling, pid);
    await addField(c, 'exp', exp, pid);
    await addField(c, 'spirit', spirit, pid);

    // 更新进度
    await c.env.DB.prepare(
      'UPDATE players SET current_stage = ?, max_stage = MAX(max_stage, ?) WHERE id = ?'
    ).bind(globalStage, globalStage, pid).run();

    // 章节进度表
    await c.env.DB.prepare(
      'INSERT INTO chapters (player_id, chapter_id, cleared_stage) VALUES (?, ?, ?) ' +
      'ON CONFLICT(player_id, chapter_id) DO UPDATE SET cleared_stage = MAX(cleared_stage, excluded.cleared_stage)'
    ).bind(pid, chapter, stage).run();

    // 战斗日志
    await c.env.DB.prepare(
      'INSERT INTO battles (player_id, chapter, stage, result, rounds, rewards_json) VALUES (?,?,?,?,?,?)'
    ).bind(pid, chapter, stage, 'win', result.rounds,
      JSON.stringify({ exp, spirit, ling })).run();
  } else {
    await c.env.DB.prepare(
      'INSERT INTO battles (player_id, chapter, stage, result, rounds) VALUES (?,?,?,?,?)'
    ).bind(pid, chapter, stage, 'lose', result.rounds).run();
  }

  return ok(c, {
    win: result.win,
    rounds: result.rounds,
    log: result.log,
    rewards: result.win ? { exp, spirit, ling } : { exp: 0, spirit: 0, ling: 0 },
  });
});

export default app;
