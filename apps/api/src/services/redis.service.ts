type RedisResult = unknown;

function getRedisConfig() {
  const url = String(process.env.REDIS_REST_URL || '').trim().replace(/\/$/, '');
  const token = String(process.env.REDIS_REST_TOKEN || '').trim();
  if (!url || !token) throw new Error('REDIS_REST_URL and REDIS_REST_TOKEN are required');
  return { url, token };
}

async function command(args: string[], timeoutMs = 5000): Promise<RedisResult> {
  const { url, token } = getRedisConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command: args }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`REDIS_HTTP_${response.status}`);
    const payload = await response.json() as { result?: RedisResult; error?: string };
    if (payload.error) throw new Error(`REDIS_COMMAND_FAILED:${payload.error}`);
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function redisGet(key: string) {
  return command(['GET', key]);
}

export async function redisSet(key: string, value: string, ttlSeconds?: number) {
  return ttlSeconds
    ? command(['SET', key, value, 'EX', String(ttlSeconds)])
    : command(['SET', key, value]);
}

export async function redisDelete(key: string) {
  return command(['DEL', key]);
}

export async function redisIncr(key: string) {
  return command(['INCR', key]);
}

export async function redisExpire(key: string, ttlSeconds: number) {
  return command(['EXPIRE', key, String(ttlSeconds)]);
}

export async function redisAddStreamEvent(streamKey: string, fields: Record<string, string>) {
  const args = ['XADD', streamKey, 'MAXLEN', '~', '1000', '*'];
  for (const [key, value] of Object.entries(fields)) args.push(key, value);
  return String(await command(args));
}

export async function redisReadStream(streamKey: string, lastId: string, blockMs = 15000) {
  return command(['XREAD', 'BLOCK', String(blockMs), 'COUNT', '50', 'STREAMS', streamKey, lastId], blockMs + 3000);
}

export async function assertRedisReady() {
  await command(['PING']);
}
