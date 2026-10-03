type Entry = { count: number; resetAt: number };
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, Entry>();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k); }, 60_000).unref();
  return {
    check(key: string) { const e = hits.get(key); return !e || e.resetAt <= Date.now() || e.count < max; },
    hit(key: string) {
      const now = Date.now(); const e = hits.get(key);
      if (!e || e.resetAt <= now) { hits.set(key, { count: 1, resetAt: now + windowMs }); return true; }
      e.count += 1; return e.count <= max;
    },
    reset(key: string) { hits.delete(key); },
  };
}
