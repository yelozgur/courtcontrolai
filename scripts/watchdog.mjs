#!/usr/bin/env node
/**
 * Watchdog — CourtControl AI self-healing probe
 *
 * Polls /api/health on the production deployment every N seconds.
 * On anomaly (any check failing OR 5xx OR latency > 3s):
 *   1. Writes structured alert to logs/watchdog.log
 *   2. Sends Telegram alert (if TELEGRAM_BOT_TOKEN + ADMIN_CHAT_ID set)
 *   3. Exits non-zero so cron can escalate
 *
 * Designed for `cron` (5min) on M5 Air (now) or M2 Air (after migration).
 * Cooldown prevents alert storms: max 1 alert per 30 min per failure type.
 *
 * Usage:
 *   PROD_URL=https://courtcontrolai.com \
 *   TELEGRAM_BOT_TOKEN=xxx \
 *   ADMIN_CHAT_ID=123456 \
 *   node scripts/watchdog.mjs
 *
 * Exit codes:
 *   0 = all healthy
 *   1 = check failed
 *   2 = network error
 *   3 = cooldown skipped (not an error, just info)
 */

import fs from 'node:fs';
import path from 'node:path';

const PROD_URL = process.env.PROD_URL || 'http://localhost:9002';
const CHECK_INTERVAL = Number(process.env.CHECK_INTERVAL || '300'); // 5 min
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min per failure-type cooldown
const LATENCY_WARN_MS = 3000;
const REQUEST_TIMEOUT_MS = 10000;

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'watchdog.log');
const COOLDOWN_FILE = path.join(LOG_DIR, 'watchdog-cooldown.json');

// Ensure log dir exists
fs.mkdirSync(LOG_DIR, { recursive: true });

function log(level, msg, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra,
  });
  fs.appendFileSync(LOG_FILE, line + '\n');
  // Also print to stderr for cron mail
  process.stderr.write(line + '\n');
}

function readCooldowns() {
  try {
    return JSON.parse(fs.readFileSync(COOLDOWN_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeCooldowns(c) {
  fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(c, null, 2));
}

function shouldAlert(key, cooldowns) {
  const last = cooldowns[key] || 0;
  return Date.now() - last > ALERT_COOLDOWN_MS;
}

function markAlerted(key, cooldowns) {
  cooldowns[key] = Date.now();
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!token || !chatId) {
    log('warn', 'telegram_not_configured', { hint: 'set TELEGRAM_BOT_TOKEN + ADMIN_CHAT_ID' });
    return false;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text();
      log('error', 'telegram_send_failed', { status: res.status, body });
      return false;
    }
    return true;
  } catch (e) {
    log('error', 'telegram_send_error', { error: (e).message });
    return false;
  }
}

function buildAlert(failures, health) {
  const lines = [
    '🚨 <b>CCA Watchdog Alert</b>',
    '',
    `Time: <code>${new Date().toISOString()}</code>`,
    `URL:  <code>${PROD_URL}</code>`,
    '',
    '<b>Failed checks:</b>',
    ...failures.map((f) => `  ❌ <code>${f.name}</code>: ${f.error || 'unknown'}`),
    '',
    `<b>Uptime:</b> ${Math.round((health.uptime_s || 0) / 60)} min`,
    `<b>Memory RSS:</b> ${health.checks?.memory?.rss_mb ?? '?'} MB`,
  ];
  return lines.join('\n');
}

async function probe() {
  const start = Date.now();
  let res;
  let health;
  try {
    res = await fetch(`${PROD_URL}/api/health`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'User-Agent': 'cca-watchdog/1.0' },
    });
    health = await res.json();
  } catch (e) {
    log('error', 'network_error', { error: (e).message, prod_url: PROD_URL });
    // Network errors ALWAYS alert (even if in cooldown) — production may be down
    await sendTelegram(
      `🚨 <b>CCA Watchdog — Network Error</b>\n\nURL: <code>${PROD_URL}</code>\nError: <code>${(e).message}</code>\n\nSite may be DOWN.`
    );
    process.exit(2);
  }

  const totalLatency = Date.now() - start;
  const failures = [];

  if (!res.ok) {
    failures.push({ name: 'http_status', error: `HTTP ${res.status}` });
  }
  if (!health.ok) {
    for (const [name, check] of Object.entries(health.checks || {})) {
      if (!check.ok) {
        failures.push({ name, error: check.error || 'check failed', latency_ms: check.latency_ms });
      }
    }
  }
  if (totalLatency > LATENCY_WARN_MS) {
    failures.push({ name: 'probe_latency', error: `${totalLatency}ms > ${LATENCY_WARN_MS}ms threshold` });
  }

  if (failures.length === 0) {
    log('info', 'healthy', {
      latency_ms: totalLatency,
      uptime_min: Math.round((health.uptime_s || 0) / 60),
      rss_mb: health.checks?.memory?.rss_mb,
    });
    process.exit(0);
  }

  // Failure path — check cooldown
  const cooldowns = readCooldowns();
  const freshFailures = failures.filter((f) => shouldAlert(`${f.name}_${f.error}`, cooldowns));
  if (freshFailures.length === 0) {
    log('warn', 'cooldown_skipped', { failures });
    process.exit(3);
  }

  log('error', 'health_check_failed', { failures, latency_ms: totalLatency });
  const sent = await sendTelegram(buildAlert(failures, health));
  if (sent) {
    for (const f of freshFailures) {
      markAlerted(`${f.name}_${f.error}`, cooldowns);
    }
    writeCooldowns(cooldowns);
  }
  process.exit(1);
}

probe().catch((e) => {
  log('error', 'unhandled_error', { error: (e).message, stack: (e).stack });
  process.exit(1);
});
