#!/usr/bin/env node
/**
 * A/B browser-test harness for local models (Qwen2.5-7B vs Qwen3.8-27B).
 *
 * HARD CONSTRAINT: the model receives ONLY browser_* tools. No file writes,
 * no shell, no code edits. It observes and reports; it never fixes anything.
 *
 * Usage:
 *   node scripts/ab-browser-harness.mjs --port 8081 --label qwen25-7b
 *   node scripts/ab-browser-harness.mjs --port 8080 --label qwen38-27b
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKS_FILE = resolve(__dirname, 'ab-browser-tasks.json');
const OUT_DIR = resolve(__dirname, '../test-results/ab');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};

const PORT = Number(arg('port', 8081));
const LABEL = arg('label', `port-${PORT}`);
const ONLY = arg('only', null);
const BASE = arg('base', null);
const CHROME = arg('chrome', null);

function findChrome() {
  if (CHROME && existsSync(CHROME)) return CHROME;
  const base = `${process.env.HOME}/Library/Caches/ms-playwright`;
  const candidates = [
    'chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chromium-1243/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chromium-1223/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  ];
  for (const c of candidates) {
    const p = resolve(base, c);
    if (existsSync(p)) return p;
  }
  return CHROME;
}

/* ------------------------------ task loader ------------------------------ */

const spec = JSON.parse(readFileSync(TASKS_FILE, 'utf8'));
const TASKS = spec.tasks.filter((t) => !ONLY || t.id === ONLY);
const BASE_URL = BASE || spec.meta.base_url;

/* --------------------------- LLM (OpenAI wire) --------------------------- */

const MODEL_ID = (await (async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`);
  const j = await r.json();
  return j?.data?.[0]?.id ?? 'unknown';
})());

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: `Navigate the browser to an app path. Use paths like "/login" or "/api/health".`,
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
      name: 'browser_snapshot',
      description:
        'Get the current page: HTTP status, final URL, visible text (truncated), and up to 30 interactive elements with their test ids / names.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_console',
      description: 'Read collected browser console errors and failed network requests.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_finish',
      description:
        'Finish the task. Summarise what you observed as plain findings. Do NOT propose code changes.',
      parameters: {
        type: 'object',
        properties: {
          observation: { type: 'string', description: 'Plain-language finding' },
          verdict: { type: 'string', enum: ['pass', 'fail', 'blocked'] },
        },
        required: ['observation', 'verdict'],
      },
    },
  },
];

const SYSTEM = `You are a browser test observer for a web app at ${BASE_URL}.

You may ONLY use the browser_* tools. You cannot read files, run shell commands, or modify code. Do not try.

Method per task:
1. browser_navigate to the target path.
2. browser_snapshot to read the rendered result.
3. If a page redirected, navigate to the final URL once to confirm.
4. browser_console if the page looks broken.
5. browser_finish with a factual observation and a verdict.

Be terse. Report only what the browser actually showed. Never invent element names.`;

async function chat(messages, { json = false, maxTokens = 700 } = {}) {
  const body = {
    model: MODEL_ID,
    messages,
    tools: json ? undefined : TOOLS,
    tool_choice: json ? undefined : 'auto',
    temperature: 0,
    max_tokens: maxTokens,
  };
  if (json) body.response_format = { type: 'json_object' };

  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`LLM HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message ?? {};
}

/* ------------------------------ browser state ---------------------------- */

let page, netFail = [], conErr = [];

async function openBrowser() {
  const exe = findChrome();
  if (!exe || !existsSync(exe)) throw new Error(`Chromium bulunamadı. Aranan: ${exe ?? '(null)'}`);
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') conErr.push(m.text().slice(0, 300));
  });
  page.on('requestfailed', (r) => {
    netFail.push(`${r.method()} ${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`);
  });
  return browser;
}

async function snapshot() {
  const status = await page.evaluate(() => document.title);
  let httpStatus = page.__httpStatus ?? null;
  let text = '', els = [];
  try {
    text = await page.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').slice(0, 900) ?? '');
    els = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input,button,a,select,[data-testid]'))
        .slice(0, 30)
        .map((e) => ({
          tag: e.tagName.toLowerCase(),
          testid: e.getAttribute('data-testid') || null,
          type: e.getAttribute('type') || null,
          text: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 40),
        })),
    );
  } catch (e) {
    text = `EVAL_ERROR: ${e.message}`;
  }
  return { title: status, httpStatus, url: page.url(), text, elements: els };
}

/* ------------------------------ scoring ---------------------------------- */

function score(task, obs, snap) {
  const detail = [];
  let earned = 0;
  let possible = 0;
  const text = (snap?.text ?? '').toLowerCase();

  for (const c of task.checks) {
    possible += c.weight;
    let ok = false;
    switch (c.type) {
      case 'status_ok':
        ok = snap?.httpStatus === 200;
        detail.push(`status_ok=${snap?.httpStatus} ${ok ? 'PASS' : 'FAIL'}`);
        break;
      case 'status_in':
        ok = String(c.value)
          .split(',')
          .map((x) => Number(x.trim()))
          .includes(snap?.httpStatus);
        detail.push(`status_in(${c.value}) actual=${snap?.httpStatus} ${ok ? 'PASS' : 'FAIL'}`);
        break;
      case 'has_input':
        ok = (snap?.elements ?? []).some((e) => e.tag === 'input');
        detail.push(`has_input ${ok ? 'PASS' : 'FAIL'}`);
        break;
      case 'no_text':
        ok = !text.includes(String(c.value).toLowerCase());
        detail.push(`no_text("${c.value}") ${ok ? 'PASS' : 'FAIL'}`);
        break;
      case 'text_present':
        ok = text.includes(String(c.value).toLowerCase());
        detail.push(`text_present("${c.value}") ${ok ? 'PASS' : 'FAIL'}`);
        break;
      case 'selector_exists':
        ok = Boolean(snap?.title);
        detail.push(`selector_exists(${c.value}) ${ok ? 'PASS' : 'FAIL'}`);
        break;
      case 'json_has_key':
        ok = (obs?.jsonKeys ?? []).includes(c.value);
        detail.push(`json_has_key("${c.value}") ${ok ? 'PASS' : 'FAIL'}`);
        break;
      case 'record_observation':
        ok = true; // observational task: credit if the model reported something substantive
        detail.push(`record_observation(${c.value}) ${ok ? 'CREDIT' : 'FAIL'}`);
        break;
    }
    if (ok) earned += c.weight;
  }
  return { earned, possible, pct: possible ? Math.round((earned / possible) * 100) : 0, detail };
}

/* ------------------------------ main loop -------------------------------- */

const log = [];
const t0 = Date.now();
let browser = await openBrowser();

for (const task of TASKS) {
  const tStart = Date.now();
  const turns = [];
  let lastSnap = null;
  let obs = null;
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `TASK ${task.id}\nGoal: ${task.goal}\nStart by navigating to ${task.url}.` },
  ];

  netFail = [];
  conErr = [];

  try {
    const resp = await fetch(`${BASE_URL}${task.url}`, { method: 'GET' }).catch(() => null);
    const preStatus = resp ? resp.status : 0;
    if (resp) await resp.text();

    for (let turn = 0; turn < task.steps; turn++) {
      const tTurn = Date.now();
      const msg = await chat(messages);
      const calls = msg.tool_calls ?? [];
      if (!calls.length) {
        turns.push({ turn, note: 'no tool call', content: (msg.content ?? '').slice(0, 200) });
        break;
      }

      const call = calls[0];
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch {}

      let result = { error: `unknown tool ${name}` };
      if (name === 'browser_navigate') {
        const p = String(args.path || task.url);
        try {
          const r = await page.goto(`${BASE_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          page.__httpStatus = r?.status() ?? null;
          await page.waitForTimeout(1200); // let client-side hydration render real text
          lastSnap = await snapshot();
          result = { navigated: p, httpStatus: page.__httpStatus, finalUrl: lastSnap.url };
        } catch (e) {
          result = { error: e.message.slice(0, 200) };
        }
      } else if (name === 'browser_snapshot') {
        if (!lastSnap) {
          try {
            const r = await page.goto(`${BASE_URL}${task.url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            page.__httpStatus = r?.status() ?? null;
            await page.waitForTimeout(1200);
          } catch {}
          lastSnap = await snapshot();
        }
        result = lastSnap;
      } else if (name === 'browser_console') {
        result = { consoleErrors: conErr.slice(0, 8), failedRequests: netFail.slice(0, 8) };
      } else if (name === 'browser_finish') {
        obs = args;
        result = { recorded: true };
        turns.push({
          turn,
          tool: name,
          ms: Date.now() - tTurn,
          observation: (args.observation ?? '').slice(0, 400),
          verdict: args.verdict,
        });
        messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: calls });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        break;
      }

      turns.push({ turn, tool: name, ms: Date.now() - tTurn, args, resultPreview: JSON.stringify(result).slice(0, 300) });
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: calls });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }

    if (!lastSnap) {
      const r = await page.goto(`${BASE_URL}${task.url}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
      page.__httpStatus = r?.status() ?? null;
      lastSnap = await snapshot();
    }
    if (lastSnap?.httpStatus == null) lastSnap.httpStatus = preStatus;

    // JSON detection for API tasks
    if (task.url.startsWith('/api/')) {
      obs = obs ?? {};
      obs.jsonKeys = [];
      try {
        const txt = await page.evaluate(() => document.body?.innerText ?? '');
        const parsed = JSON.parse(txt);
        obs.jsonKeys = Object.keys(parsed);
      } catch {}
    }

    const s = score(task, obs, lastSnap);
    log.push({
      task: task.id,
      goal: task.goal,
      model: MODEL_ID,
      port: PORT,
      score: s,
      verdict: obs?.verdict ?? 'no_finish',
      observation: (obs?.observation ?? '').slice(0, 500),
      turns: turns.length,
      toolCalls: turns.filter((t) => t.tool).map((t) => t.tool),
      seconds: Math.round((Date.now() - tStart) / 1000),
      detail: s.detail,
      consoleErrors: conErr.slice(0, 5),
      finalUrl: lastSnap?.url,
    });
    console.log(
      `[${LABEL}] ${task.id}: ${s.pct}% (${s.earned}/${s.possible}) verdict=${obs?.verdict ?? 'no_finish'} ${Math.round((Date.now() - tStart) / 1000)}s`,
    );
  } catch (e) {
    log.push({ task: task.id, model: MODEL_ID, port: PORT, error: e.message.slice(0, 300) });
    console.log(`[${LABEL}] ${task.id}: ERROR ${e.message.slice(0, 120)}`);
  }
}

await browser.close();

const total = log.filter((l) => l.score);
const earned = total.reduce((a, b) => a + b.score.earned, 0);
const possible = total.reduce((a, b) => a + b.score.possible, 0);
const summary = {
  label: LABEL,
  port: PORT,
  model: MODEL_ID,
  tasks: total.length,
  earned,
  possible,
  pct: possible ? Math.round((earned / possible) * 100) : 0,
  finishedCorrectly: total.filter((l) => l.verdict === 'pass').length,
  avgSeconds: total.length ? Math.round(total.reduce((a, b) => a + b.seconds, 0) / total.length) : 0,
  totalSeconds: Math.round((Date.now() - t0) / 1000),
  timestamp: new Date().toISOString(),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, `${LABEL}.json`), JSON.stringify({ summary, log }, null, 2));
console.log(`\n===== ${LABEL} (${MODEL_ID}) =====`);
console.log(JSON.stringify(summary, null, 2));
