/**
 * 前端 API client（Vue 3 全局版 + 原生 fetch，纯浏览器 JS，无构建）
 * API base：后端 Workers 自定义域名
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

// 直接挂到全局，供 main.js 使用（零构建，不用 import/export）
// 注意：不要用顶层 const api = {...}，否则与 main.js 的 const api 全局重复声明冲突
window.api = {
  // auth
  register: (username, password, nickname) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname }),
    }),
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  // game（注意：Hono 路由不含尾斜杠，/api/game/ 会 404）
  game: () => request('/api/game'),

  // battle
  fight: (chapter, stage) =>
    request('/api/battle/fight', {
      method: 'POST',
      body: JSON.stringify({ chapter, stage }),
    }),

  // afk
  afkCollect: () => request('/api/afk/collect', { method: 'POST' }),
  afkStatus: () => request('/api/afk/status'),
};
