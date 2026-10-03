type CounterMap = Map<string, number>;

const counters: CounterMap = new Map();
const latency: CounterMap = new Map();
let recent5xx: number[] = [];
let lastAlertAt = 0;

function inc(key: string, value = 1) {
  counters.set(key, (counters.get(key) || 0) + value);
}

function observe(key: string, milliseconds: number) {
  const bucket = milliseconds < 100 ? 'lt100' : milliseconds < 250 ? '100_250' : milliseconds < 500 ? '250_500' : milliseconds < 1000 ? '500_1000' : 'gte1000';
  const metricKey = `latency_${key}_${bucket}`;
  latency.set(metricKey, (latency.get(metricKey) || 0) + 1);
}

export function recordRequest(method: string, route: string, status: number, milliseconds: number) {
  const safeRoute = route.split('?')[0].slice(0, 120);
  inc(`http_requests_total|method=${method}|route=${safeRoute}|status=${status}`);
  observe(`${method}_${safeRoute}`, milliseconds);
  if (status >= 500) recent5xx.push(Date.now());
  const cutoff = Date.now() - 60_000;
  recent5xx = recent5xx.filter((timestamp) => timestamp >= cutoff);
}

export function recordMediaFailure(kind: string) {
  inc(`media_failures_total|kind=${kind}`);
}

export function recordCallFailure(kind: string) {
  inc(`call_failures_total|kind=${kind}`);
}

export function prometheusMetrics() {
  const lines = [
    '# HELP sdm_http_requests_total Total HTTP responses by method, route and status.',
    '# TYPE sdm_http_requests_total counter',
  ];
  for (const [key, value] of counters) {
    const [metric, ...labels] = key.split('|');
    const rendered = labels.length ? `{${labels.map((item) => {
      const [k, v] = item.split('=');
      return `${k}="${String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }).join(',')}}` : '';
    lines.push(`sdm_${metric}${rendered} ${value}`);
  }
  lines.push('# HELP sdm_request_latency_bucket Approximate request latency buckets.');
  lines.push('# TYPE sdm_request_latency_bucket counter');
  for (const [key, value] of latency) {
    const parts = key.split('_');
    const bucket = parts.pop() || 'unknown';
    lines.push(`sdm_request_latency_bucket{bucket="${bucket}",route="${parts.join('_').replace(/"/g, '')}"} ${value}`);
  }
  lines.push(`sdm_http_5xx_last_minute ${recent5xx.length}`);
  return lines.join('\n') + '\n';
}

export async function maybeAlertOn5xx(log: (message: string, data?: unknown) => void) {
  const threshold = Number(process.env.ALERT_5XX_PER_MINUTE || 20);
  if (recent5xx.length < threshold || Date.now() - lastAlertAt < 300_000) return;
  lastAlertAt = Date.now();
  const payload = {
    event: 'sdm_api_5xx_spike',
    countLastMinute: recent5xx.length,
    timestamp: new Date().toISOString(),
  };
  log('API 5xx spike detected', payload);
  const webhook = String(process.env.ALERT_WEBHOOK_URL || '').trim();
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    log('Alert webhook delivery failed', { error });
  }
}
