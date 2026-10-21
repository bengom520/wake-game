/**
 * API: 功勋商店（购买商品）
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail, casDeduct, addField } from '../lib/helpers';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface ShopItem {
  key: string; name: string; cost: number; period: 'daily' | 'weekly' | 'lifetime';
  limit: number; type: string; item_key?: string; qty?: number; title_name?: string; desc: string;
}

// GET /api/shop 商品列表 + 限购状态
app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const items = await getTemplate<ShopItem[]>(c, 'shop_items', []);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const bought = await c.env.DB.prepare(
    `SELECT item_key, COUNT(*) as cnt FROM shop_log
     WHERE player_id = ? AND created_at >= ?
     GROUP BY item_key`
  ).bind(pid, weekAgo).all<{ item_key: string; cnt: number }>();
  const boughtMap: Record<string, number> = {};
  (bought.results ?? []).forEach(b => { boughtMap[b.item_key] = b.cnt; });

  const player = await c.env.DB.prepare(
    'SELECT gongxun FROM players WHERE id = ?'
  ).bind(pid).first<{ gongxun: number }>();

  return ok(c, {
    items: items.map(it => ({
      ...it,
      bought: boughtMap[it.key] ?? 0,
      remaining: it.limit - (boughtMap[it.key] ?? 0),
    })),
    gongxun: player?.gongxun ?? 0,
  });
});

// POST /api/shop/buy { key }
app.post('/buy', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const body = await c.req.json<{ key: string }>();
  const items = await getTemplate<ShopItem[]>(c, 'shop_items', []);
  const item = items.find(i => i.key === body.key);
  if (!item) return fail(c, '商品不存在');

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const boughtRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM shop_log WHERE player_id = ? AND item_key = ? AND created_at >= ?`
  ).bind(pid, item.key, weekAgo).first<{ cnt: number }>();
  if ((boughtRow?.cnt ?? 0) >= item.limit) return fail(c, '已达限购');

  const paid = await casDeduct(c, 'gongxun', item.cost, pid);
  if (!paid) return fail(c, `功勋不足（需 ${item.cost}）`);

  let reward = '';
  if (item.type === 'ling' && item.qty) {
    await addField(c, 'ling_stone', item.qty, pid);
    reward = `灵石 +${item.qty}`;
  } else if (item.type === 'item' && item.item_key) {
    await c.env.DB.prepare(
      'INSERT INTO player_items (player_id, item_key, qty) VALUES (?, ?, ?) ' +
      'ON CONFLICT(player_id, item_key) DO UPDATE SET qty = qty + excluded.qty'
    ).bind(pid, item.item_key, item.qty ?? 1).run();
    reward = `${item.name} ×${item.qty ?? 1}`;
  } else if (item.type === 'free_summon_1' || item.type === 'free_summon_10') {
    const freeLing = item.type === 'free_summon_1' ? 30 : 250;
    await addField(c, 'ling_stone', freeLing, pid);
    reward = `免费抽抵用券 → 灵石 +${freeLing}`;
  } else if (item.type === 'title') {
    reward = `称号「${item.title_name}」已解锁`;
  }

  await c.env.DB.prepare(
    'INSERT INTO shop_log (player_id, item_key, qty, cost, period) VALUES (?, ?, 1, ?, ?)'
  ).bind(pid, item.key, item.cost, item.period).run();

  return ok(c, { msg: `购买成功：${reward}`, reward });
});

export default app;
