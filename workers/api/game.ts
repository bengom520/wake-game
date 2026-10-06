/**
 * API: 主城面板（玩家全量数据 + 阵容 + 羁绊 + 挂机状态）
 */
import { Hono } from 'hono';
import type { Env, Vars, Hero, Artifact, Bond } from '../lib/types';
import { requirePlayerId, getTemplate, ok, fail } from '../lib/helpers';
import { loadPlayer } from '../lib/auth';

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

interface HeroTemplate {
  key: string; name: string; quality: number; attack: number;
  hp?: number; role: string; skill: string; img: string;
}
interface BondTemplate {
  key: string; name: string; members: string[]; bonus: string; img: string;
}
interface ArtifactTemplate {
  key: string; name: string; type: string; effect: string; chapter: number; img: string;
}

app.get('/', async (c) => {
  const pid = await requirePlayerId(c);
  if (!pid) return fail(c, '未登录', 401);

  const player = await loadPlayer(c.env.DB, pid);
  if (!player) return fail(c, '玩家数据缺失', 500);

  const heroes = await c.env.DB.prepare(
    'SELECT * FROM heroes WHERE player_id = ? ORDER BY slot ASC, quality DESC'
  ).bind(pid).all<Hero>();
  const artifacts = await c.env.DB.prepare(
    'SELECT * FROM artifacts WHERE player_id = ? ORDER BY acquired_at DESC'
  ).bind(pid).all<Artifact>();
  const bonds = await c.env.DB.prepare(
    'SELECT * FROM bonds WHERE player_id = ?'
  ).bind(pid).all<Bond>();
  const chapters = await c.env.DB.prepare(
    'SELECT * FROM chapters WHERE player_id = ? ORDER BY chapter_id'
  ).bind(pid).all();

  // 读模板
  const heroTpl = await getTemplate<HeroTemplate[]>(c, 'heroes', []);
  const bondTpl = await getTemplate<BondTemplate[]>(c, 'bonds', []);
  const artifactTpl = await getTemplate<ArtifactTemplate[]>(c, 'artifacts', []);
  const chapterTpl = await getTemplate<any[]>(c, 'chapters', []);

  // 合并英雄数据 + 模板
  const heroList = (heroes.results ?? []).map(h => {
    const tpl = heroTpl.find(t => t.key === h.hero_key);
    return {
      ...h,
      name: tpl?.name ?? h.hero_key,
      img: tpl?.img ?? '/assets/heroes/placeholder.png',
      role: tpl?.role ?? '未知',
      skill: tpl?.skill ?? '—',
      base_attack: tpl?.attack ?? 100,
      hp_mult: tpl?.hp ?? 1.0,
    };
  });

  // 羁绊激活检测：上阵英雄 key 集合
  const activeKeys = new Set(
    heroList.filter(h => h.slot >= 0).map(h => h.hero_key)
  );
  const bondsWithActive = bondTpl.map(b => ({
    ...b,
    active: b.members.every(m => activeKeys.has(m)),
    owned: b.members.filter(m => activeKeys.has(m)).length,
    total: b.members.length,
  }));

  return ok(c, {
    player,
    heroes: heroList,
    artifacts: (artifacts.results ?? []).map(a => {
      const tpl = artifactTpl.find(t => t.key === a.artifact_key);
      return { ...a, name: tpl?.name ?? a.artifact_key, effect: tpl?.effect ?? '', img: tpl?.img ?? '' };
    }),
    bonds: bondsWithActive,
    chapters: chapterTpl.map(ct => {
      const prog = (chapters.results ?? []).find(p => p.chapter_id === ct.id);
      return { ...ct, cleared_stage: prog?.cleared_stage ?? 0, boss_cleared: prog?.boss_cleared ?? 0 };
    }),
    version: c.env.GAME_VERSION,
  });
});

export default app;
