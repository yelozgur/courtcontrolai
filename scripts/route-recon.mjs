#!/usr/bin/env node
/**
 * Route reconnaissance: probe every app route + API endpoint and record the
 * ACTUAL current behaviour (status, redirect, rendered text, console errors).
 * Tests are written against observed reality, not assumptions.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../test-results/ab');
const BASE = 'http://127.0.0.1:9002';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const ROUTES = [
  '/', '/login', '/signup', '/tournaments', '/tournaments/new', '/sponsors', '/arena',
  '/tournaments/1/bracket', '/tournaments/1/check-in', '/tournaments/1/leaderboard',
  '/tournaments/1/register', '/tournaments/1/results', '/arena/1', '/referee/1',
  '/dashboard', '/dashboard/profile', '/dashboard/club', '/dashboard/schedule',
  '/dashboard/tournaments', '/dashboard/tournaments/new', '/dashboard/tournaments/1/edit',
  '/dashboard/participants', '/dashboard/check-in', '/dashboard/sponsors',
  '/dashboard/admin/users', '/dashboard/admin/clubs', '/dashboard/admin/costs',
  '/dashboard/admin/marketing', '/dashboard/admin/marketing/queue',
  '/api/health', '/api/scheduler/solve', '/api/telegram/send', '/api/telegram/test',
  '/api/firestore/users', '/nonexistent-route-xyz',
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const results = [];

for (const route of ROUTES) {
  const p = await ctx.newPage();
  const conErr = [];
  const netFail = [];
  p.on('console', (m) => m.type() === 'error' && conErr.push(m.text().slice(0, 200)));
  p.on('requestfailed', (r) => netFail.push(`${r.method()} ${r.url().replace(BASE, '').slice(0, 90)}`));

  let status = null, navErr = null;
  try {
    const r = await p.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    status = r?.status() ?? null;
  } catch (e) { navErr = e.message.slice(0, 150); }

  let text = '', title = '', jsonKeys = null, inputs = 0, buttons = 0;
  try {
    await p.waitForTimeout(1400);
    text = await p.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 260) ?? '');
    title = await p.title();
    inputs = await p.evaluate(() => document.querySelectorAll('input').length);
    buttons = await p.evaluate(() => document.querySelectorAll('button').length);
    try { jsonKeys = Object.keys(JSON.parse(text)); } catch {}
  } catch (e) { text = `EVAL_ERR ${e.message.slice(0, 80)}`; }

  const finalUrl = p.url().replace(BASE, '');
  const redirected = finalUrl !== route;
  await p.close();
  results.push({
    route, status, finalUrl, redirected: finalUrl !== route,
    title, text, jsonKeys, inputs, buttons,
    consoleErrors: conErr.slice(0, 3), failedRequests: netFail.slice(0, 3), navErr,
  });
  const flag = status >= 500 ? ' <-- 5xx' : status === 404 ? ' <-- 404' : redirected ? ` <-- ${finalUrl}` : '';
  console.log(`${String(status).padEnd(4)} ${route.padEnd(40)}${flag}`);
}

await browser.close();
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'route-recon.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
console.log(`\nKaydedildi: test-results/ab/route-recon.json (${results.length} route)`);
