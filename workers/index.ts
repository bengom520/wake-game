/**
 * 修仙：挂机觉醒 - Cloudflare Workers 后端入口
 * 单人本地玩模式（未来多人化改 route 分发）
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Vars } from './lib/types';

import auth from './api/auth';
import game from './api/game';
import battle from './api/battle';
import heroes from './api/heroes';
import artifacts from './api/artifacts';
import bonds from './api/bonds';
import shop from './api/shop';
import afk from './api/afk';
import chapters from './api/chapters';
import tasks from './api/tasks';
import save from './api/save';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// CORS 配置（允许前端跨域）
app.use('*', cors({
  origin: ['https://wake-game.bengom.xyz', 'http://localhost:5173'],
  credentials: true,
}));

// 健康检查
app.get('/health', (c) => c.json({
  status: 'ok',
  title: '修仙：挂机觉醒',
  version: 'v1.0.0',
  mode: 'single_player',
}));

// API 路由分发
app.route('/api/auth', auth);
app.route('/api/game', game);
app.route('/api/battle', battle);
app.route('/api/heroes', heroes);
app.route('/api/artifacts', artifacts);
app.route('/api/bonds', bonds);
app.route('/api/shop', shop);
app.route('/api/afk', afk);
app.route('/api/chapters', chapters);
app.route('/api/tasks', tasks);
app.route('/api/save', save);

// 404 fallback
app.notFound((c) => c.json({ ok: false, msg: 'API not found' }, 404));

// 错误处理
app.onError((err, c) => {
  console.error('[wake-game error]', err);
  return c.json({ ok: false, msg: 'Internal Server Error' }, 500);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
