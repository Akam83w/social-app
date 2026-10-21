import { Capacitor } from '@capacitor/core';

const API_URL = Capacitor.isNativePlatform() ? (import.meta.env.VITE_API_URL || 'https://lush-topaz-3759.de.deplexo.com') : (import.meta.env.PROD ? window.location.origin : (import.meta.env.VITE_API_URL || 'http://localhost:3000'));

export { API_URL };

export async function register(data: { username: string; email?: string; password: string; displayName?: string }) {
  const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'REGISTER_FAILED');
  return json;
}

export async function exchangeOAuthToken(data: { accessToken: string; provider?: string }) {
  const res = await fetch(`${API_URL}/auth/oauth/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'OAUTH_FAILED');
  return json;
}

export function getSocialLoginUrl(provider: 'facebook' | 'twitter', redirectTo?: string) {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co').replace(/\/$/, '');
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_S3vz_Xl82eFWfZbdkN10yg_T13ig_kZ');
  if (!supabaseUrl || !publishableKey) throw new Error('SOCIAL_LOGIN_NOT_CONFIGURED');
  const url = new URL(`${supabaseUrl}/auth/v1/authorize`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', redirectTo || window.location.origin + '/auth/callback');
  return url.toString();
}

export async function getLinkedSocialAccounts(token: string) { return apiRequest('/auth/oauth/linked', token); }
export async function linkSocialAccount(token: string, accessToken: string, provider: 'facebook' | 'twitter') { return apiRequest('/auth/oauth/link', token, { method: 'POST', body: JSON.stringify({ accessToken, provider }) }); }
export async function unlinkSocialAccount(token: string, provider: 'facebook' | 'twitter') { return apiRequest('/auth/oauth/linked/' + provider, token, { method: 'DELETE' }); }

export async function login(data: { usernameOrEmail: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'LOGIN_FAILED');
  return json;
}

export async function uploadVideoResumable(
  token: string,
  file: File,
  content: string,
  onProgress?: (pct: number) => void,
  onUploadComplete?: () => void,
  preparePath = '/posts/video/prepare',
  completePath = '/posts/video/complete',
) {
  const prepare = await apiRequest(preparePath, token, {
    method: 'POST',
    body: JSON.stringify({ contentType: file.type || 'video/mp4', size: file.size }),
  }) as { bucketName: string; objectName: string; token: string; endpoint: string; signedUrl?: string };

  const uploadKey = 'sdm_tus_' + prepare.objectName;
  let uploadUrl = '';
  let offset = 0;
  const updateProgress = (uploaded: number) => onProgress?.(Math.min(99, Math.round((uploaded / file.size) * 100)));

  try {
    const metadata = btoa(`bucket ${prepare.bucketName},object ${prepare.objectName},contentType ${file.type || 'video/mp4'}`);
    const saved = localStorage.getItem(uploadKey);
    if (saved) {
      try {
        const previous = JSON.parse(saved) as { url?: string; offset?: number; token?: string };
        if (previous.url && previous.token === prepare.token) {
          uploadUrl = previous.url;
          offset = previous.offset || 0;
        }
      } catch {}
    }
    if (!uploadUrl) {
      const created = await createTusUpload(prepare.endpoint, prepare.token, file.size, metadata);
      uploadUrl = created.url;
      offset = created.offset;
      localStorage.setItem(uploadKey, JSON.stringify({ url: uploadUrl, offset, token: prepare.token }));
    }
    while (offset < file.size) {
      try {
        offset = await uploadTusChunk(uploadUrl, prepare.token, file.slice(offset, Math.min(offset + 2 * 1024 * 1024, file.size)), offset, file.size, updateProgress);
        localStorage.setItem(uploadKey, JSON.stringify({ url: uploadUrl, offset, token: prepare.token }));
      } catch {
        offset = await tusHead(uploadUrl, prepare.token);
        localStorage.setItem(uploadKey, JSON.stringify({ url: uploadUrl, offset, token: prepare.token }));
      }
    }
  } catch (error) {
    if (!prepare.signedUrl) throw error;
    await uploadSignedVideo(prepare.signedUrl, file, updateProgress);
  }

  onProgress?.(100);
  onUploadComplete?.();
  localStorage.removeItem(uploadKey);

  return apiRequest(completePath, token, {
    method: 'POST',
    body: JSON.stringify({ objectName: prepare.objectName, content, contentType: file.type || 'video/mp4' }),
  });
}

function uploadSignedVideo(signedUrl: string, file: File, onProgress: (uploaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.setRequestHeader('Cache-Control', 'max-age=31536000');
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('VIDEO_SIGNED_UPLOAD_FAILED'));
    xhr.onerror = () => reject(new Error('VIDEO_NETWORK_ERROR'));
    xhr.send(file);
  });
}

function tusHeaders(signature: string, extra: Record<string, string> = {}) {
  return { 'Tus-Resumable': '1.0.0', 'x-signature': signature, ...extra };
}

function createTusUpload(endpoint: string, signature: string, size: number, metadata: string): Promise<{ url: string; offset: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    for (const [key, value] of Object.entries(tusHeaders(signature, {
      'Upload-Length': String(size),
      'Upload-Metadata': metadata,
      'x-upsert': 'false',
    }))) xhr.setRequestHeader(key, value);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { reject(new Error('VIDEO_UPLOAD_INIT_FAILED')); return; }
      const location = xhr.getResponseHeader('Location');
      if (!location) { reject(new Error('VIDEO_UPLOAD_INIT_FAILED')); return; }
      resolve({ url: new URL(location, endpoint).toString(), offset: Number(xhr.getResponseHeader('Upload-Offset') || 0) });
    };
    xhr.onerror = () => reject(new Error('VIDEO_NETWORK_ERROR'));
    xhr.send();
  });
}

function tusHead(url: string, signature: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', url);
    for (const [key, value] of Object.entries(tusHeaders(signature))) xhr.setRequestHeader(key, value);
    xhr.onload = () => resolve(Number(xhr.getResponseHeader('Upload-Offset') || 0));
    xhr.onerror = () => reject(new Error('VIDEO_NETWORK_ERROR'));
    xhr.send();
  });
}

function uploadTusChunk(url: string, signature: string, chunk: Blob, offset: number, _total: number, onProgress: (uploaded: number) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PATCH', url);
    for (const [key, value] of Object.entries(tusHeaders(signature, {
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': String(offset),
    }))) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(offset + event.loaded);
      else onProgress(offset);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { reject(new Error('VIDEO_UPLOAD_CHUNK_FAILED')); return; }
      resolve(Number(xhr.getResponseHeader('Upload-Offset') || (offset + chunk.size)));
    };
    xhr.onerror = () => reject(new Error('VIDEO_NETWORK_ERROR'));
    xhr.send(chunk);
  });
}

const inflight = new Map<string, Promise<unknown>>();
const prefetched = new Map<string, { data: unknown; expiresAt: number }>();

export async function apiRequest(path: string, token: string | null, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const method = (options.method || 'GET').toUpperCase();
  const key = method === 'GET' ? method + ':' + path + ':' + (token || '') : '';

  if (key) {
    const cached = prefetched.get(key);
    if (cached) {
      if (cached.expiresAt > Date.now()) return cached.data;
      prefetched.delete(key);
    }
    if (inflight.has(key)) return inflight.get(key);
  }

  const request = (async () => {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { throw new Error('INVALID_SERVER_RESPONSE'); }
    if (!res.ok) {
      const err = String(json.error || 'REQUEST_FAILED');
      if (res.status === 401 || err === 'UNAUTHORIZED' || err === 'SESSION_REVOKED') {
        try { window.dispatchEvent(new CustomEvent('sdm:unauthorized', { detail: { path, error: err } })); } catch {}
      }
      throw new Error(err);
    }
    return json;
  })();

  if (!key) return request;
  inflight.set(key, request);
  try { return await request; } finally { inflight.delete(key); }
}

export function prefetchApi(path: string, token: string, ttlMs = 30_000) {
  const key = 'GET:' + path + ':' + token;
  const existing = prefetched.get(key);
  if (existing && existing.expiresAt > Date.now()) return Promise.resolve(existing.data);
  const running = inflight.get(key);
  const promise = (running || apiRequest(path, token)).then(data => {
    prefetched.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  }).catch(error => {
    prefetched.delete(key);
    throw error;
  });
  return promise;
}

export function clearPrefetchedApi(path?: string, token?: string | null) {
  if (!path) { prefetched.clear(); return; }
  prefetched.delete('GET:' + path + ':' + (token || ''));
}

export function readCache<T>(key: string, maxAgeMs = 10 * 60 * 1000): T | null {
  try {
    const raw = localStorage.getItem('sdm_cache_' + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; v: T };
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.v;
  } catch { return null; }
}

export function writeCache<T>(key: string, value: T) {
  try { localStorage.setItem('sdm_cache_' + key, JSON.stringify({ t: Date.now(), v: value })); } catch {}
}

export async function getPostLikeStatus(postId: string, token: string) { return apiRequest(`/posts/${postId}/like`, token); }
export async function likePost(postId: string, token: string) { return apiRequest(`/posts/${postId}/like`, token, { method: 'POST' }); }
export async function unlikePost(postId: string, token: string) { return apiRequest(`/posts/${postId}/like`, token, { method: 'DELETE' }); }
export async function getPostComments(postId: string, token: string) { return apiRequest(`/posts/${postId}/comments`, token); }
export async function createComment(postId: string, content: string, token: string, parentCommentId?: string) {
  return apiRequest(`/posts/${postId}/comments`, token, { method: 'POST', body: JSON.stringify({ content, ...(parentCommentId ? { parentCommentId } : {}) }) });
}
export async function deleteComment(commentId: string, token: string) { return apiRequest(`/comments/${commentId}`, token, { method: 'DELETE' }); }
export async function likeComment(commentId: string, token: string) { return apiRequest(`/comments/${commentId}/like`, token, { method: 'POST' }); }
export async function unlikeComment(commentId: string, token: string) { return apiRequest(`/comments/${commentId}/like`, token, { method: 'DELETE' }); }
export async function getActiveUsers(token: string) { return apiRequest('/presence/active', token); }
export async function getMessageNotes(token: string) { return apiRequest('/messages/notes', token); }
export async function setMessageNote(token: string, content: string) { return apiRequest('/messages/notes', token, { method: 'POST', body: JSON.stringify({ content }) }); }
export async function deleteMessageNote(token: string) { return apiRequest('/messages/notes', token, { method: 'DELETE' }); }
export async function pingPresence(token: string) { return apiRequest('/presence/ping', token, { method: 'POST' }); }

export function connectRealtime(token: string, onEvent: (event: any) => void) {
  const es = new EventSource(API_URL + '/realtime?token=' + encodeURIComponent(token));
  es.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch {} };
  return () => es.close();
}
export function startCall(token: string, toUserId: string, video: boolean) { return apiRequest('/calls/start', token, { method: 'POST', body: JSON.stringify({ toUserId, video }) }); }
export function getCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId), token); }
export function getCallConfig(token: string) { return apiRequest('/calls/config', token); }
export function acceptCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId) + '/accept', token, { method: 'POST' }); }
export function rejectCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId) + '/reject', token, { method: 'POST' }); }
export function endCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId) + '/end', token, { method: 'POST' }); }
export function sendSignal(token: string, toUserId: string, kind: string, payload: any) {
  return apiRequest('/calls/signal', token, { method: 'POST', body: JSON.stringify({ toUserId, kind, payload }) });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.register('/sw.js').catch(() => {});
}
