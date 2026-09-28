export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

export async function registerUser(data: {
  username: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'REGISTER_FAILED');
  }

  return json;
}

export async function loginUser(data: {
  identifier: string;
  password: string;
}) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'LOGIN_FAILED');
  }

  return json;
}

export async function apiRequest(
  path: string,
  token: string | null,
  options: RequestInit = {},
) {
  const headers = new Headers(options.headers);

    if (options.body) headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'REQUEST_FAILED');
  }

  return json;
}


export async function getPostLikeStatus(
  postId: string,
  token: string,
) {
  return apiRequest(`/posts/${postId}/like`, token);
}

export async function likePost(postId: string, token: string) {
  return apiRequest(`/posts/${postId}/like`, token, {
    method: 'POST',
  });
}

export async function unlikePost(postId: string, token: string) {
  return apiRequest(`/posts/${postId}/like`, token, {
    method: 'DELETE',
  });
}

export async function getPostComments(postId: string, token: string) {
  return apiRequest(`/posts/${postId}/comments`, token);
}

export async function createComment(
  postId: string,
  content: string,
  token: string,
  parentCommentId?: string,
) {
  return apiRequest(`/posts/${postId}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({
      content,
      ...(parentCommentId ? { parentCommentId } : {}),
    }),
  });
}

export async function deleteComment(commentId: string, token: string) {
  return apiRequest(`/comments/${commentId}`, token, {
    method: 'DELETE',
  });
}


export function connectRealtime(token:string,onEvent:(event:any)=>void){const baseUrl=API_URL;const es=new EventSource(baseUrl+'/realtime?token='+encodeURIComponent(token));es.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.type==='ready')return;onEvent(data)}catch{}};return()=>es.close()}
export function startCall(token:string,toUserId:string,video:boolean){return apiRequest('/calls/start',token,{method:'POST',body:JSON.stringify({toUserId,video})})}
export function getCall(token:string,callId:string){return apiRequest('/calls/'+encodeURIComponent(callId),token)}
export function acceptCall(token:string,callId:string){return apiRequest('/calls/'+encodeURIComponent(callId)+'/accept',token,{method:'POST'})}
export function rejectCall(token:string,callId:string){return apiRequest('/calls/'+encodeURIComponent(callId)+'/reject',token,{method:'POST'})}
export function endCall(token:string,callId:string){return apiRequest('/calls/'+encodeURIComponent(callId)+'/end',token,{method:'POST'})}
export function sendSignal(token:string,toUserId:string,kind:string,payload:unknown){const API_URL=import.meta.env.VITE_API_URL||'http://localhost:3000';return fetch(API_URL+'/calls/signal',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({toUserId,kind,payload})})}
