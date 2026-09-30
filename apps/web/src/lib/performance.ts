import { API_URL } from "./api";

type Metric = { name: string; value: number; path: string; connection?: string };

const sent = new Set<string>();

function send(metric: Metric) {
  const key = metric.name + ":" + Math.round(metric.value);
  if (sent.has(key)) return;
  sent.add(key);
  const body = JSON.stringify(metric);
  try {
    if (navigator.sendBeacon && !location.protocol.startsWith("capacitor")) {
      navigator.sendBeacon(API_URL + "/performance", new Blob([body], { type: "application/json" }));
    } else {
      fetch(API_URL + "/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {}
}

export function startPerformanceMonitoring() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
  const common = { path: location.pathname, ...(connection ? { connection } : {}) };

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") send({ name: "FCP", value: entry.startTime, ...common });
      }
    }).observe({ type: "paint", buffered: true });
  } catch {}

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const value = (entry as PerformanceEntry & { value?: number }).value;
        if (typeof value === "number") send({ name: "CLS", value, ...common });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const value = (entry as PerformanceEntry & { processingStart?: number }).processingStart;
        if (typeof value === "number") send({ name: "INP", value: value - entry.startTime, ...common });
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  } catch {}

  window.addEventListener("load", () => {
    window.setTimeout(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav) send({ name: "LOAD", value: nav.loadEventEnd - nav.startTime, ...common });
    }, 0);
  }, { once: true });
}
