/**
 * API: TODO — 待老板/豆包补实现（骨架已就绪，照抄 game.ts / battle.ts / afk.ts 的模式）
 * 参考实现要点：
 *   1. requirePlayerId(c) 拿玩家 ID
 *   2. getTemplate(c, 'xxx', []) 读 site_meta 模板
 *   3. 操作 D1（c.env.DB.prepare(...).bind(...).run()/first()/all()）
 *   4. 返回 ok(c, {...}) / fail(c, 'msg', 401)
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import { requirePlayerId, ok, fail } from '../lib/helpers';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// TODO: 在此实现具体路由（GET 列表 / POST 操作）

app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);
  return ok(c, { todo: 'API 未实现', module: 'STUB' });
});

export default app;
