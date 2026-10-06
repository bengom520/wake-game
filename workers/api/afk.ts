/**
 * API: 挂机 / 离线收益（次神核心玩法）
 * 挂机开启后自动打怪，最多累计 8 小时离线收益
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail, addField, getMeta, setMeta } from '../lib/helpers';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface AfkCfg {
  max_minutes: number;
  ling_per_hour: number;
  spirit_per_hour: number;
  stone_per_hour: number;
  pill_per_hour: number;
}

// 挂机状态 + 结算：POST /api/afk/collect
app.post('/collect', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const player = await c.env.DB.prepare(
    'SELECT * FROM players WHERE id = ?'
  ).bind(pid).first<{ id: number; last_collect: string; ling_stone: number; spirit: number }>();
  if (!player) return fail(c, '玩家数据缺失', 500);

  const cfg = await getTemplate<AfkCfg>(c, 'afk', {
    max_minutes: 480, ling_per_hour: 50, spirit_per_hour: 30,
    stone_per_hour: 5, pill_per_hour: 1,
  });

  // 计算时长
  const last = new Date(player.last_collect).getTime();
  const now = Date.now();
  const elapsedMinutes = Math.floor((now - last) / 60000);
  const cappedMinutes = Math.min(elapsedMinutes, cfg.max_minutes);

  if (cappedMinutes < 1) {
    return ok(c, {
      minutes: 0, rewards: { ling: 0, spirit: 0, stone: 0, pill: 0 },
      msg: '挂机时间不足 1 分钟',
    });
  }

  // 按分钟比例算收益
  const hours = cappedMinutes / 60;
  const ling = Math.floor(cfg.ling_per_hour * hours);
  const spirit = Math.floor(cfg.spirit_per_hour * hours);
  const stone = Math.floor(cfg.stone_per_hour * hours);
  const pill = Math.floor(cfg.pill_per_hour * hours);

  // 发放
  if (ling > 0) await addField(c, 'ling_stone', ling, pid);
  if (spirit > 0) await addField(c, 'spirit', spirit, pid);
  if (stone > 0) {
    await c.env.DB.prepare(
      'INSERT INTO player_items (player_id, item_key, qty) VALUES (?, ?, ?) ' +
      'ON CONFLICT(player_id, item_key) DO UPDATE SET qty = qty + excluded.qty'
    ).bind(pid, 'star_stone', stone).run();
  }
  if (pill > 0) {
    await c.env.DB.prepare(
      'INSERT INTO player_items (player_id, item_key, qty) VALUES (?, ?, ?) ' +
      'ON CONFLICT(player_id, item_key) DO UPDATE SET qty = qty + excluded.qty'
    ).bind(pid, 'god_pill', pill).run();
  }

  // 更新 last_collect（避免重复领取）
  await c.env.DB.prepare(
    'UPDATE players SET last_collect = ? WHERE id = ?'
  ).bind(new Date().toISOString(), pid).run();

  // 记录
  await c.env.DB.prepare(
    'INSERT INTO afk_collects (player_id, collect_amount, duration_seconds, rewards_json) VALUES (?,?,?,?)'
  ).bind(pid, ling + spirit, cappedMinutes * 60,
    JSON.stringify({ ling, spirit, stone, pill })).run();

  return ok(c, {
    minutes: cappedMinutes,
    rewards: { ling, spirit, stone, pill },
    msg: cappedMinutes < elapsedMinutes
      ? `挂机 ${cappedMinutes} 分钟（已达 ${cfg.max_minutes} 分钟上限）`
      : `挂机 ${cappedMinutes} 分钟`,
  });
});

// 挂机状态（不结算）：GET /api/afk/status
app.get('/status', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const player = await c.env.DB.prepare(
    'SELECT last_collect FROM players WHERE id = ?'
  ).bind(pid).first<{ last_collect: string }>();
  if (!player) return fail(c, '玩家数据缺失', 500);

  const elapsedMinutes = Math.floor((Date.now() - new Date(player.last_collect).getTime()) / 60000);
  return ok(c, { elapsed_minutes: Math.max(0, elapsedMinutes) });
});

export default app;
