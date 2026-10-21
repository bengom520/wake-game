/**
 * 前端 API client（Vue 3 全局版 + 原生 fetch，纯浏览器 JS，无构建）
 */
const API_BASE = 'https://api.wake-game.bengom.xyz';

async function request(path, options) {
  options = options || {};
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return await res.json();
}

window.api = {
  // auth
  register: (username, password, nickname) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, nickname }) }),
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  // game
  game: () => request('/api/game'),

  // battle
  fight: (chapter, stage) =>
    request('/api/battle/fight', { method: 'POST', body: JSON.stringify({ chapter, stage }) }),

  // afk
  afkCollect: () => request('/api/afk/collect', { method: 'POST' }),
  afkStatus: () => request('/api/afk/status'),

  // heroes
  heroes: () => request('/api/heroes'),
  heroDeploy: (id, slot) =>
    request('/api/heroes/deploy', { method: 'POST', body: JSON.stringify({ id, slot }) }),
  heroLevelup: (id) =>
    request('/api/heroes/levelup', { method: 'POST', body: JSON.stringify({ id }) }),
  heroStarup: (id) =>
    request('/api/heroes/starup', { method: 'POST', body: JSON.stringify({ id }) }),

  // gacha
  gachaInfo: () => request('/api/gacha/info'),
  gachaSingle: () => request('/api/gacha/single', { method: 'POST' }),
  gachaTen: () => request('/api/gacha/ten', { method: 'POST' }),

  // shop
  shop: () => request('/api/shop'),
  shopBuy: (key) =>
    request('/api/shop/buy', { method: 'POST', body: JSON.stringify({ key }) }),

  // tasks
  tasks: () => request('/api/tasks'),
  taskClaim: (key) =>
    request('/api/tasks/claim', { method: 'POST', body: JSON.stringify({ key }) }),

  // artifacts
  artifacts: () => request('/api/artifacts'),
  artifactUpgrade: (key) =>
    request('/api/artifacts/upgrade', { method: 'POST', body: JSON.stringify({ key }) }),

  // chapters
  chapters: () => request('/api/chapters'),
  chapterBoss: (chapter) =>
    request('/api/chapters/boss', { method: 'POST', body: JSON.stringify({ chapter }) }),

  // bonds
  bonds: () => request('/api/bonds'),

  // save
  save: () => request('/api/save'),
};
