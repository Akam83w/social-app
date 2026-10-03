import { Capacitor } from '@capacitor/core';

const API_URL = Capacitor.isNativePlatform() ? (import.meta.env.VITE_API_URL || 'https://lush-topaz-3759.de.deplexo.com') : (import.meta.env.PROD ? window.location.origin : (import.meta.env.VITE_API_URL || 'http://localhost:3000'));

export { API_URL };

export async function registerUser(data: { username: string; email: string; phone?: string; password: string; passwordConfirmation: string }) {
  const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'REGISTER_FAILED');
  return json;
}

export async function exchangeOAuthToken(data: { accessToken: string; provider: 'facebook' | 'twitter'; username?: string; phone?: string }) {
  const res = await fetch(`${API_URL}/auth/oauth/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) { const error = new Error(json.error || 'OAUTH_EXCHANGE_FAILED') as Error & { code?: string }; error.code = json.error; throw error; }
  return json;
}

export function startSocialLogin(provider: 'facebook' | 'twitter', mode: 'login' | 'link' = 'login') {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || 'https://beytuhfnhksgwdcsjdzs.supabase.co').replace(/\/$/, '');
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_S3vz_Xl82eFWfZbdkN10yg_T13ig_kZ');
  if (!supabaseUrl || !publishableKey) throw new Error('SOCIAL_LOGIN_NOT_CONFIGURED');
  const url = new URL(`${supabaseUrl}/auth/v1/authorize`);
  url.searchParams.set('provider', provider === 'twitter' ? 'x' : 'facebook');
  url.searchParams.set('redirect_to', window.location.origin + '/auth/callback?provider=' + encodeURIComponent(provider) + '&mode=' + encodeURIComponent(mode));
  url.searchParams.set('apikey', publishableKey);
  window.location.assign(url.toString());
}


export async function getLinkedSocialAccounts(token: string) { return apiRequest('/auth/oauth/linked', token); }
export async function linkSocialAccount(token: string, accessToken: string, provider: 'facebook' | 'twitter') { return apiRequest('/auth/oauth/link', token, { method: 'POST', body: JSON.stringify({ accessToken, provider }) }); }
export async function unlinkSocialAccount(token: string, provider: 'facebook' | 'twitter') { return apiRequest('/auth/oauth/linked/' + provider, token, { method: 'DELETE' }); }

export async function loginUser(data: { identifier: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'LOGIN_FAILED');
  return json;
}

export async function uploadVideo(
  path: string,
  token: string,
  form: FormData,
  onProgress?: (percent: number) => void,
  onUploadComplete?: () => void,
): Promise<any> {
  const file = form.get('file');
  if (!(file instanceof File)) throw new Error('VIDEO_REQUIRED');
  const content = String(form.get('content') || '');
  const preparePath = path + '/upload';
  const completePath = path + '/complete';

  const prepare = await apiRequest(preparePath, token, {
    method: 'POST',
    body: JSON.stringify({ contentType: file.type || 'video/mp4', extension: file.name.split('.').pop() || 'mp4', size: file.size }),
  }) as { bucketName: string; objectName: string; token: string; endpoint: string; signedUrl?: string };

  const uploadKey = 'sdm-video-upload:' + btoa(unescape(encodeURIComponent(
    [path, file.name, file.size, file.lastModified, file.type].join('|')
  ))).replace(/=+$/g, '');
  let uploadUrl = '';
  let offset = 0;
  const metadata = [
    ['bucketName', prepare.bucketName],
    ['objectName', prepare.objectName],
    ['contentType', file.type || 'video/mp4'],
    ['cacheControl', '31536000'],
  ].map(([key, value]) => key + ' ' + btoa(unescape(encodeURIComponent(value)))).join(',');

  const saved = localStorage.getItem(uploadKey);
  if (saved) {
    try {
      const previous = JSON.parse(saved) as { url?: string; offset?: number; token?: string };
      if (previous.url && previous.token === prepare.token) {
        uploadUrl = previous.url;
        offset = Math.max(0, Math.min(file.size, previous.offset || 0));
      }
    } catch {}
  }

  const updateProgress = (value: number) => onProgress?.(Math.min(100, Math.round((value / file.size) * 100)));

  try {
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
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { reject(new Error('VIDEO_UPLOAD_RESUME_FAILED')); return; }
      resolve(Number(xhr.getResponseHeader('Upload-Offset') || 0));
    };
    xhr.onerror = () => reject(new Error('VIDEO_NETWORK_ERROR'));
    xhr.send();
  });
}

function uploadTusChunk(
  url: string,
  signature: string,
  chunk: Blob,
  offset: number,
  _total: number,
  onProgress: (uploaded: number) => void,
): Promise<number> {
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
export async function likeComment(commentId: string, token: string) { return apiRequest(`/comments/${commentId}/like`, token, { method: 'POST' }); }
export async function unlikeComment(commentId: string, token: string) { return apiRequest(`/comments/${commentId}/like`, token, { method: 'DELETE' }); }
export async function getActiveUsers(token: string) { return apiRequest('/presence/active', token); }
export async function getMessageNotes(token: string) { return apiRequest('/messages/notes', token); }
export async function setMessageNote(token: string, content: string) { return apiRequest('/messages/notes', token, { method: 'POST', body: JSON.stringify({ content }) }); }
export async function deleteMessageNote(token: string) { return apiRequest('/messages/notes', token, { method: 'DELETE' }); }
export async function pingPresence(token: string) { return apiRequest('/presence/ping', token, { method: 'POST' }); }

export function connectRealtime(token: string, onEvent: (event: any) => void) {
  const es = new EventSource(API_URL + '/realtime?token=' + encodeURIComponent(token));
  es.onmessage = e => { try { const data = JSON.parse(e.data); if (data.type === 'ready') return; onEvent(data); } catch {} };
  return () => es.close();
}
export function startCall(token: string, toUserId: string, video: boolean) { return apiRequest('/calls/start', token, { method: 'POST', body: JSON.stringify({ toUserId, video }) }); }
export function getCall(token: string, callId: string) { return apiRequest('/calls/' + encodeURIComponent(callId), token); }
export function getCallConfig(token: string) { return apiRequest('/calls/config', token); }
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
