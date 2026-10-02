import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SMOKE_PORT || 3310);
const storagePort = Number(process.env.SMOKE_STORAGE_PORT || 4310);
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, 'DATABASE_URL is required');

const storage = http.createServer((req, res) => {
  const url = req.url || '';
  if (req.method === 'GET' && url === '/storage/v1/bucket') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('[]');
    return;
  }
  if (req.method === 'POST' && url === '/storage/v1/bucket/sdm-media') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'sdm-media', name: 'sdm-media', public: true }));
    return;
  }
  if (req.method === 'POST' && url.startsWith('/storage/v1/object/sdm-media/')) {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ Key: url.replace('/storage/v1/object/sdm-media/', '') }));
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
});

await new Promise((resolve, reject) => storage.listen(storagePort, '127.0.0.1', resolve).on('error', reject));

const migration = spawnSync('npx', ['drizzle-kit', 'migrate', '--config=drizzle.config.ts'], {
  cwd: apiDir,
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: 'inherit',
});
if (migration.status !== 0) {
  storage.close();
  throw new Error(`Database-from-scratch migration failed with exit code ${migration.status}`);
}

const api = spawn('node', ['dist/server.js'], {
  cwd: apiDir,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: process.env.JWT_SECRET || 'smoke-test-jwt-secret-012345678901234567890123',
    PORT: String(port),
    SUPABASE_URL: `http://127.0.0.1:${storagePort}`,
    SUPABASE_SERVICE_ROLE_KEY: 'smoke-test-storage-key',
    CORS_ORIGIN: 'http://127.0.0.1',
    OPENAI_API_KEY: 'smoke-test-openai-key',
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require ${path.join(apiDir, 'tests/smoke-fetch-mock.cjs')}`].filter(Boolean).join(' '),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
api.stdout.on('data', (chunk) => { logs += String(chunk); });
api.stderr.on('data', (chunk) => { logs += String(chunk); });

async function request(url, init = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, init);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { response, body, text };
}

try {
  let health;
  for (let i = 0; i < 60; i += 1) {
    try {
      health = await request('/health');
      if (health.response.status === 200) break;
    } catch {}
    await sleep(500);
  }
  assert.equal(health?.response.status, 200, `/health failed\\n${logs}`);
  assert.equal(health?.body?.status, 'ok');

  const suffix = Date.now().toString(36);
  const username = `smoke_${suffix}`;
  const email = `${username}@example.test`;
  const password = 'SmokeTestPass123!';

  const register = await request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, email, password, displayName: 'Smoke Test' }),
  });
  assert.equal(register.response.status, 201, JSON.stringify(register.body));
  assert.ok(register.body?.user?.id);

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.body));
  const token = login.body?.token;
  assert.ok(token);

  const image = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' });
  const form = new FormData();
  form.append('file', image, 'smoke.png');
  const upload = await request('/posts/image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(upload.response.status, 201, JSON.stringify(upload.body));
  assert.equal(upload.body?.mediaType, 'image');
  assert.match(String(upload.body?.mediaUrl), /sdm-media/);

  const post = await request('/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'CI smoke post', mediaUrl: upload.body.mediaUrl, mediaType: 'image' }),
  });
  assert.equal(post.response.status, 201, JSON.stringify(post.body));
  assert.ok(post.body?.post?.id);
  assert.equal(post.body?.post?.mediaType, 'image');

  console.log('SMOKE TEST PASSED: /health, register, login, image upload, create post');
} catch (error) {
  console.error('SMOKE TEST FAILED');
  console.error(error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  api.kill('SIGTERM');
  await sleep(500);
  storage.close();
}
