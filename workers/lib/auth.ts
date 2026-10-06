/**
 * Auth 工具：JWT + session cookie + bcrypt 密码哈希
 * 单人玩简化版（无邮箱验证、无密码强度检查）
 */
import type { Context, Next } from 'hono';
import type { Env, Vars, User, Player } from './types';

const COOKIE_NAME = 'wake_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

// 简化密码哈希（Web Crypto API：PBKDF2）
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return 'pbkdf2$' + btoa(String.fromCharCode(...salt)) + '$' +
         btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [algo, saltB64, bitsB64] = hash.split('$');
  if (algo !== 'pbkdf2') return false;
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const expected = Uint8Array.from(atob(bitsB64), c => c.charCodeAt(0));
  return constantTimeEqual(new Uint8Array(bits), expected);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Session token（base64 编码 JSON）
export interface SessionData {
  user_id: number;
  username: string;
  player_id: number;
  exp: number;
}

export function createSession(data: SessionData): string {
  return btoa(JSON.stringify(data));
}

export function parseSession(token: string): SessionData | null {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

export function getCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict; Secure`;
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;
}

// Auth middleware：从 cookie 解析 user 并挂到 c.set('user')
export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Vars }>, next: Next) {
  const cookie = c.req.header('Cookie') ?? '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) {
    return c.json({ ok: false, msg: '未登录' }, 401);
  }
  const session = parseSession(match[1]);
  if (!session) {
    return c.json({ ok: false, msg: 'session 无效' }, 401);
  }
  c.set('user', {
    id: session.user_id,
    username: session.username,
    player_id: session.player_id,
  });
  await next();
}

// 加载玩家数据
export async function loadPlayer(pdo: D1Database, player_id: number): Promise<Player | null> {
  return await pdo.prepare('SELECT * FROM players WHERE id = ?').bind(player_id).first<Player>();
}
