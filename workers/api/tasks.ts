/**
 * API: 每日任务（列表 / 领奖）
 */
import { Hono } from 'hono';
import type { Env, Vars } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail, addField } from '../lib/helpers';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface DailyTask {
  key: string; name: string; desc: string; target: number;
  reward_gongxun: number; reward_ling: number; reward_spirit: number;
}

// GET /api/tasks 任务列表 + 进度 + 领奖状态
app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const tasks = await getTemplate<DailyTask[]>(c, 'daily_tasks', []);
  const today = new Date().toISOString().slice(0, 10);

  // 读今日任务进度
  const logs = await c.env.DB.prepare(
    'SELECT * FROM task_log WHERE player_id = ? AND day_date = ?'
  ).bind(pid, today).all();

  const logMap: Record<string, { progress: number; completed_at: string | null; claimed_at: string | null }> = {};
  (logs.results ?? []).forEach((l: any) => {
    logMap[l.task_key] = {
      progress: l.progress,
      completed_at: l.completed_at,
      claimed_at: l.claimed_at,
    };
  });

  return ok(c, {
    date: today,
    tasks: tasks.map(t => {
      const log = logMap[t.key];
      return {
        ...t,
        progress: log?.progress ?? 0,
        claimed: !!log?.claimed_at,
        done: (log?.progress ?? 0) >= t.target,
      };
    }),
  });
});

// POST /api/tasks/claim { key } 领奖
app.post('/claim', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const body = await c.req.json<{ key: string }>();
  const tasks = await getTemplate<DailyTask[]>(c, 'daily_tasks', []);
  const task = tasks.find(t => t.key === body.key);
  if (!task) return fail(c, '任务不存在');

  const today = new Date().toISOString().slice(0, 10);
  const log = await c.env.DB.prepare(
    'SELECT * FROM task_log WHERE player_id = ? AND task_key = ? AND day_date = ?'
  ).bind(pid, task.key, today).first<{ id: number; progress: number; claimed_at: string | null }>();

  if (!log || log.progress < task.target) return fail(c, '任务未完成');
  if (log.claimed_at) return fail(c, '已领取');

  // 发奖励
  if (task.reward_gongxun) await addField(c, 'gongxun', task.reward_gongxun, pid);
  if (task.reward_ling) await addField(c, 'ling_stone', task.reward_ling, pid);
  if (task.reward_spirit) await addField(c, 'spirit', task.reward_spirit, pid);

  await c.env.DB.prepare(
    'UPDATE task_log SET claimed_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(log.id).run();

  return ok(c, {
    msg: `领取成功：${task.name}`,
    rewards: { gongxun: task.reward_gongxun, ling: task.reward_ling, spirit: task.reward_spirit },
  });
});

export default app;
