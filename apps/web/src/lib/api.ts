const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
