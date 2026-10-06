#!/usr/bin/env node
/**
 * Fix-advisor phase: after the browser-test run, ask the local model to review
 * the OBSERVED failures and propose fixes. The model still gets browser_*
 * tools only — it can verify its own claims, but it cannot edit code.
 *
 * Usage:
 *   node scripts/ab-fix-advisor.mjs --port 8081 --label qwen25-7b-final
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../test-results/ab');
const BASE = 'http://127.0.0.1:9002';

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const PORT = Number(arg('port', 8081));
const LABEL = arg('label', 'qwen25-7b-final');

const run = JSON.parse(readFileSync(resolve(OUT_DIR, `${LABEL}.json`), 'utf8'));
const MODEL_ID = (await (async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`);
  return (await r.json())?.data?.[0]?.id ?? 'unknown';
})());

/* ------------------------- browser tools (verify only) ------------------- */

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'browser_open',
      description: 'Open a path and return HTTP status, final URL, visible text, console errors, failed requests, and JSON keys if the response is JSON.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'App path starting with /' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_finish',
      description:
        'Finish with a remediation proposal. Findings must be based on what the browser actually returned.',
      parameters: {
        type: 'object',
        properties: {
          root_cause: { type: 'string', description: 'What is actually broken, in one or two sentences' },
          evidence: { type: 'string', description: 'The browser evidence that proves it' },
          fix_proposal: { type: 'string', description: 'Proposed fix, described in words. Do NOT write code.' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          needs_code_change: { type: 'boolean' },
        },
        required: ['root_cause', 'evidence', 'fix_proposal', 'priority'],
      },
    },
  },
];

const SYSTEM = `You are a remediation analyst for the web app at ${BASE}.

You may ONLY use the browser_* tools. You cannot read or edit files, and you cannot run shell commands. Do not try.

You will be given test failures. Method:
1. Use browser_open to reproduce each reported failure and gather real evidence (status codes, error text, failed requests, JSON keys).
2. Distinguish a genuine application bug from a mis-written test expectation.
3. Call browser_finish once with a single consolidated proposal.

Describe the fix in plain words. Never emit code.`;

async function chat(messages) {
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_ID,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0,
      max_tokens: 900,
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}`);
  return r.json().then((j) => j.choices?.[0]?.message ?? {});
}

/* ------------------------------ browser open ----------------------------- */

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

async function open(path) {
  const p = await ctx.newPage();
  const conErr = [];
  const netFail = [];
  p.on('console', (m) => m.type() === 'error' && conErr.push(m.text().slice(0, 250)));
  p.on('requestfailed', (r) => netFail.push(`${r.method()} ${r.url().slice(0, 110)}`));
  let status = null;
  try {
    const r = await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    status = r?.status() ?? null;
  } catch (e) {
    return { path, error: e.message.slice(0, 200) };
  }
  await p.waitForTimeout(1500);
  const text = await p.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').slice(0, 600) ?? '');
  const jsonKeys = [];
  try {
    jsonKeys = Object.keys(JSON.parse(text));
  } catch {}
  await p.close();
  return {
    path,
    httpStatus: status,
    finalUrl: p.url(),
    visibleText: text,
    jsonKeys: jsonKeys.length ? jsonKeys : undefined,
    consoleErrors: conErr.slice(0, 4),
    failedRequests: netFail.slice(0, 4),
  };
}

/* ------------------------------- run phases ------------------------------ */

const failures = run.log
  .filter((e) => e.verdict === 'fail' || (e.consoleErrors ?? []).length > 0 || e.score.pct < 100)
  .map((e) => ({
    task: e.task,
    goal: e.goal,
    verdict: e.verdict,
    score: `${e.score.pct}%`,
    observation: (e.observation ?? '').slice(0, 300),
    consoleErrors: (e.consoleErrors ?? []).slice(0, 3),
    finalUrl: e.finalUrl,
  }));

console.log(`Advisor: ${failures.length} incelenecek bulgu (${MODEL_ID})`);

const phases = [
  {
    id: 'P1-health-and-config',
    brief: `The /api/health endpoint returned HTTP 503 and the page reports it as degraded. Also /dashboard renders a "syncing" shell with Firestore network failures. Reproduce both and identify the single root cause.`,
    probe: ['/api/health', '/dashboard'],
  },
  {
    id: 'P2-admin-queue',
    brief: `The /dashboard/admin/marketing/queue page rendered only a "SYNCING CONSOLE..." shell with no interactive elements and no data. Reproduce it and explain why it renders empty.`,
    probe: ['/dashboard/admin/marketing/queue'],
  },
  {
    id: 'P3-auth-boundary',
    brief: `Navigation to /dashboard and /dashboard/admin/marketing/queue did NOT redirect to /login. Reproduce both and state whether unauthenticated users can read protected admin pages.`,
    probe: ['/dashboard', '/dashboard/admin/marketing/queue', '/login'],
  },
];

const results = [];
for (const ph of phases) {
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `FAILURES TO REVIEW:\n${JSON.stringify(failures, null, 1)}\n\nYOUR ASSIGNMENT (${ph.id}):\n${ph.brief}` },
  ];
  let out = null;
  const steps = [];
  try {
    for (let i = 0; i < 6; i++) {
      const msg = await chat(messages);
      const call = msg.tool_calls?.[0];
      if (!call) break;
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch {}
      let res;
      if (name === 'browser_open') {
        res = await open(String(args.path || ph.probe[0]));
        steps.push(res);
      } else if (name === 'browser_finish') {
        out = args;
        break;
      } else res = { error: `unknown ${name}` };
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: [call] });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(res) });
    }
  } catch (e) {
    out = { error: e.message.slice(0, 200) };
  }
  results.push({ phase: ph.id, assignment: ph.brief, probes: steps, proposal: out });
  console.log(`[${LABEL}] ${ph.id}: ${out ? `root_cause="${(out.root_cause ?? '').slice(0, 80)}" priority=${out.priority}` : 'NO PROPOSAL'}`);
}

await browser.close();

const out = {
  label: LABEL,
  model: MODEL_ID,
  base: BASE,
  generatedAt: new Date().toISOString(),
  reviewedFailures: failures.length,
  phases: results,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, `${LABEL}-fix-advisor.json`), JSON.stringify(out, null, 2));
console.log(`\nYazıldı: test-results/ab/${LABEL}-fix-advisor.json`);
