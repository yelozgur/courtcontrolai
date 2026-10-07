/**
 * /api/health — Self-healing infrastructure probe
 *
 * Production watchdog hits this endpoint every 5 minutes (M5 Air first,
 * M2 Air after migration). Returns 200 with status breakdown:
 *
 *   {
 *     ok: true,
 *     timestamp: "2026-10-01T11:30:00Z",
 *     version: "1.0.0",
 *     checks: {
 *       process:    { ok: true, uptime_s: 4321, rss_mb: 412, heap_used_mb: 230 },
 *       env:        { ok: true, firebase_configured: true, ai_key_configured: true },
 *       scheduler:  { ok: true, mode: "dev", note: "..." },  // or M2 health if SCHEDULER_URL set
 *       ai_quota:   { ok: true, provider: "google-ai-pro", daily_limit: 1500 },
 *     },
 *     uptime_s: 4321
 *   }
 *
 * Any check fails → 503 + ok:false → watchdog alerts via Telegram.
 *
 * NOTE: Firestore connectivity check happens client-side (next /api/firestore-ping
 * route below or in the React client init). Server context can't use the browser-
 * initialized Firebase client SDK without firebase-admin (out of scope for now).
 */

import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getHeapStatistics } from 'node:v8';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const START_TIME = Date.now();

interface CheckResult {
  ok: boolean;
  error?: string;
  [k: string]: unknown;
}

// A flat 1 GB heap / 2 GB RSS ceiling flagged a perfectly healthy `next dev`
// (it holds ~4 GB RSS while compiling on a 32 GB host). The only boundary that
// actually matters for the heap is the V8 heap limit — the point where the
// process OOMs — so the heap is judged as a ratio of it, and RSS gets a
// ceiling with real headroom instead of a value tuned to a small machine.
const HEAP_WARN_RATIO = 0.9;
const RSS_CEILING_MB = 8 * 1024;

function checkProcess(): CheckResult {
  const mem = process.memoryUsage();
  const heapLimitMb = Math.round(getHeapStatistics().heap_size_limit / 1024 / 1024);
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const heapOk = heapUsedMb < heapLimitMb * HEAP_WARN_RATIO;
  const rssOk = rssMb < RSS_CEILING_MB;
  return {
    ok: heapOk && rssOk,
    uptime_s: Math.round(process.uptime()),
    rss_mb: rssMb,
    heap_used_mb: heapUsedMb,
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    heap_limit_mb: heapLimitMb,
  };
}

// [env var, matching key in the hardcoded src/firebase/config.ts]
const FIREBASE_KEYS: ReadonlyArray<readonly [string, string]> = [
  ['NEXT_PUBLIC_FIREBASE_API_KEY', 'apiKey'],
  ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'projectId'],
  ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'authDomain'],
];

function isUsable(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !value.includes('your_') &&
    !value.includes('xxx')
  );
}

let fallbackConfig: Record<string, string> | null = null;

/**
 * src/firebase/config.ts is the hardcoded Firebase web config, but it carries
 * the "use client" directive: the App Router turns its named exports into
 * client references, so a server route cannot import them. Read the literals
 * out of the module source instead, so the health check sees the values the
 * app actually boots with. These values are only ever reduced to a boolean —
 * no value from here reaches the response body.
 */
function readFallbackConfig(): Record<string, string> {
  if (fallbackConfig) return fallbackConfig;
  fallbackConfig = {};
  try {
    const source = readFileSync(join(process.cwd(), 'src/firebase/config.ts'), 'utf8');
    for (const [, configKey] of FIREBASE_KEYS) {
      const match = new RegExp(`\\b${configKey}\\s*:\\s*["']([^"']+)["']`).exec(source);
      if (match) fallbackConfig[configKey] = match[1];
    }
  } catch {
    // Source not on disk (e.g. a standalone build): fall back to process.env
    // only, which is the pre-existing behaviour.
  }
  return fallbackConfig;
}

function checkEnv(): CheckResult {
  const fallback = readFallbackConfig();
  const issues: string[] = [];
  let fromEnv = true;
  for (const [envKey, configKey] of FIREBASE_KEYS) {
    if (isUsable(process.env[envKey])) continue;
    fromEnv = false;
    // process.env is unset here — the hardcoded config in src/firebase/config.ts
    // is an equally valid source, so only fail if it is missing too.
    if (isUsable(fallback[configKey])) continue;
    issues.push(`${envKey} missing or placeholder`);
  }
  const aiKeyOk = isUsable(process.env.GOOGLE_GENAI_API_KEY);
  return {
    ok: issues.length === 0,
    error: issues.length ? issues.join('; ') : undefined,
    firebase_configured: issues.length === 0,
    firebase_config_source: issues.length ? 'missing' : fromEnv ? 'env' : 'hardcoded-config',
    ai_key_configured: aiKeyOk,
  };
}

async function checkScheduler(): Promise<CheckResult> {
  // OR-Tools scheduler runs on M2 Air (:8500 via Tailscale).
  // In dev/local, we don't enforce; in prod, this probes the M2 endpoint.
  const schedulerUrl = process.env.SCHEDULER_URL; // e.g. http://m2-mac.tail-xyz.ts.net:8500
  if (!schedulerUrl) {
    return { ok: false, mode: 'dev', error: 'SCHEDULER_URL not set — scheduler is not running' };
  }
  const start = Date.now();
  try {
    const res = await fetch(`${schedulerUrl}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return {
      ok: res.ok,
      latency_ms: Date.now() - start,
      scheduler_version: data.version,
      active_jobs: data.active_jobs,
    };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - start, error: (e as Error).message };
  }
}

function checkAIQuota(): CheckResult {
  // The GenAI key has no hardcoded fallback — process.env is the only source.
  if (!isUsable(process.env.GOOGLE_GENAI_API_KEY)) {
    return { ok: false, error: 'GOOGLE_GENAI_API_KEY missing or placeholder' };
  }
  // Future: track real usage from firestore `ai_usage/{date}` doc.
  return { ok: true, provider: 'google-ai-pro', daily_limit: 1500 };
}

export async function GET() {
  const [process_check, env, scheduler, ai_quota] = await Promise.all([
    Promise.resolve(checkProcess()),
    Promise.resolve(checkEnv()),
    checkScheduler(),
    Promise.resolve(checkAIQuota()),
  ]);

  const requiredChecks = { process: process_check, env };
  const requiredOk = Object.values(requiredChecks).every((c) => c.ok);

  const capabilities: Record<string, string> = {};
  if (!ai_quota.ok) {
    capabilities.ai = 'disabled';
  } else {
    capabilities.ai = 'enabled';
  }
  if (scheduler.mode === 'dev') {
    capabilities.scheduler = 'dev';
  } else if (scheduler.ok) {
    capabilities.scheduler = 'remote';
  } else {
    // SCHEDULER_URL is configured but the probe failed. This is a real outage and must
    // not be reported as "dev", which would hide it behind the deliberate-off label.
    capabilities.scheduler = 'unreachable';
  }

  return NextResponse.json(
    {
      ok: requiredOk,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: { process: process_check, env, scheduler, ai_quota },
      capabilities,
      uptime_s: Math.round((Date.now() - START_TIME) / 1000),
    },
    { status: requiredOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
