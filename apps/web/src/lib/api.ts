import { Capacitor } from '@capacitor/core';

const API_URL = Capacitor.isNativePlatform() ? (import.meta.env.VITE_API_URL || 'https://lush-topaz-3759.de.deplexo.com') : (import.meta.env.PROD ? window.location.origin : (import.meta.env.VITE_API_URL || 'http://localhost:3000'));

export { API_URL };

export async function registerUser(data: { username: string; email: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'REGISTER_FAILED');
  return json;
}

export async function loginUser(data: { identifier: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'LOGIN_FAILED');
  return json;
}

const inflight = new Map<string, Promise<unknown>>();

export async function apiRequest(path: string, token: string | null, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const method = (options.method || 'GET').toUpperCase();
  const key = method === 'GET' ? method + ':' + path + ':' + (token || '') : '';
  if (key && inflight.has(key)) return inflight.get(key);

  const request = (async () => {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { throw new Error('INVALID_SERVER_RESPONSE'); }
    if (!res.ok) throw new Error(json.error || 'REQUEST_FAILED');
    return json;
  })();

  if (!key) return request;
  inflight.set(key, request);
  try { return await request; } finally { inflight.delete(key); }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => {
    const schedule = () => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register('sdm-refresh').catch(() => {});
    schedule();
    window.addEventListener('online', schedule);
  }).catch(() => {});
}

export async function getPostLikeStatus(postId: string, token: string) { return apiRequest(`/posts/${postId}/like`, token); }
export async function likePost(postId: string, token: string) { return apiRequest(`/posts/${postId}/like`, token, { method: 'POST' }); }
export async function unlikePost(postId: string, token: string) { return apiRequest(`/posts/${postId}/like`, token, { method: 'DELETE' }); }
export async function getPostComments(postId: string, token: string) { return apiRequest(`/posts/${postId}/comments`, token); }
export async function createComment(postId: string, content: string, token: string, parentCommentId?: string) {
  return apiRequest(`/posts/${postId}/comments`, token, { method: 'POST', body: JSON.stringify({ content, ...(parentCommentId ? { parentCommentId } : {}) }) });
}
export async function deleteComment(commentId: string, token: string) { return apiRequest(`/comments/${commentId}`, token, { method: 'DELETE' }); }

export function connectRealtime(token: string, onEvent: (event: any) => void) {
  const es = new EventSource(API_URL + '/realtime?token=' + encodeURIComponent(token));
  es.onmessage = e => { try { const data = JSON.parse(e.data); if (data.type === 'ready') return; onEvent(data); } catch {} };
  return () => es.close();
}
export function startCall(token: string, toUserId: string, video: boolean) { return apiRequest('/calls/start', token, { method: 'POST', body: JSON.stringify({ toUserId, video }) }); }
export function getCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId), token); }
export function acceptCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId) + '/accept', token, { method: 'POST' }); }
export function rejectCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId) + '/reject', token, { method: 'POST' }); }
export function endCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId) + '/end', token, { method: 'POST' }); }
export function sendSignal(token: string, toUserId: string, kind: string, payload: unknown) {
  return fetch(API_URL + '/calls/signal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ toUserId, kind, payload }) });
}


const CACHE_PREFIX = 'dijla-cache:';
export const readCache = <T,>(key: string, maxAgeMs = 5 * 60 * 1000): T | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const item = JSON.parse(raw) as { savedAt: number; data: T };
    if (!item || typeof item.savedAt !== 'number' || Date.now() - item.savedAt > maxAgeMs) return null;
    return item.data ?? null;
  } catch { return null; }
};
export const writeCache = <T,>(key: string, data: T) => {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), data })); } catch {}
};
export const removeCache = (key: string) => { try { localStorage.removeItem(CACHE_PREFIX + key); } catch {} };
