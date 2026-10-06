#!/usr/bin/env node
/**
 * Hand FIX_TASK_7B.md to the local model (Qwen2.5-7B on :8081) and let it apply
 * the fixes file-by-file. The model is given file read/edit tools ONLY —
 * no browser, no shell, no test execution. It must report per fix.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = 8081;
const TASK = readFileSync(resolve(ROOT, 'docs/FIX_TASK_7B.md'), 'utf8');

const MODEL = (await (await fetch(`http://127.0.0.1:${PORT}/v1/models`)).json()).data[0].id;

/* Only file tools. No shell, no browser, no test runner. */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a source file from the project. Path relative to project root.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Replace an exact string in a file. old_string must appear exactly once. ' +
        'Use this to make a precise, minimal change.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file with the given complete content.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_report',
      description: 'Record a fix report. Call once at the end.',
      parameters: {
        type: 'object',
        properties: {
          fixes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fix: { type: 'string' },
                file: { type: 'string' },
                change: { type: 'string' },
                verified: { type: 'string' },
              },
              required: ['fix', 'file', 'change', 'verified'],
            },
          },
          not_fixed: { type: 'string' },
        },
        required: ['fixes'],
      },
    },
  },
];

const SYSTEM = `You are a code-fixing agent. You have ONLY file tools: read_file, edit_file, create_file, write_report.

You cannot run shell commands, cannot run tests, cannot use a browser. The verification
commands in the task are for the HUMAN to run later — do not claim you ran them. For the
"verified" field, describe the change you made and what SHOULD happen, and be honest that
you could not execute it yourself.

Method:
1. read_file the target, understand the CURRENT code.
2. Make the SMALLEST change that fixes the root cause.
3. Follow the fix order: FIX 1 through FIX 7.
4. call write_report once at the end.

Never invent code you have not read. Never edit files outside the allowed list.`;

async function chat(messages) {
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0, max_tokens: 1500 }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}`);
  return (await r.json()).choices?.[0]?.message ?? {};
}

const messages = [
  { role: 'system', content: SYSTEM },
  { role: 'user', content: `TASK:\n\n${TASK}\n\nStart with FIX 1. Read src/app/dashboard/layout.tsx first.` },
];

let report = null;
const log = [];

for (let i = 0; i < 40; i++) {
  const msg = await chat(messages);
  const call = msg.tool_calls?.[0];
  if (!call) {
    log.push(`[${i}] no tool call: ${(msg.content ?? '').slice(0, 150)}`);
    break;
  }
  const name = call.function?.name;
  let a = {};
  try { a = JSON.parse(call.function?.arguments || '{}'); } catch {}

  let res;
  if (name === 'read_file') {
    try {
      const p = resolve(ROOT, a.path);
      if (!p.startsWith(ROOT)) res = { error: 'path escapes project root' };
      else res = { path: a.path, content: readFileSync(p, 'utf8').slice(0, 9000) };
    } catch (e) { res = { error: e.message.slice(0, 200) }; }
  } else if (name === 'edit_file') {
    try {
      const p = resolve(ROOT, a.path);
      const cur = readFileSync(p, 'utf8');
      if (!cur.includes(a.old_string)) res = { error: 'old_string not found — read the file again and copy the EXACT text' };
      else if (cur.split(a.old_string).length - 1 > 1) res = { error: 'old_string is not unique — include more context' };
      else {
        writeFileSync(p, cur.replace(a.old_string, a.new_string));
        res = { ok: true, path: a.path };
      }
    } catch (e) { res = { error: e.message.slice(0, 200) }; }
  } else if (name === 'create_file') {
    try {
      const p = resolve(ROOT, a.path);
      writeFileSync(p, a.content);
      res = { ok: true, path: a.path, bytes: a.content.length };
    } catch (e) { res = { error: e.message.slice(0, 200) }; }
  } else if (name === 'write_report') {
    report = a;
    res = { recorded: true };
    log.push(`[${i}] REPORT: ${a.fixes?.length ?? 0} fixes`);
    break;
  } else res = { error: `unknown tool ${name}` };

  log.push(`[${i}] ${name} ${a.path ?? ''} -> ${JSON.stringify(res).slice(0, 110)}`);
  messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: [call] });
  messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(res).slice(0, 9000) });
}

const out = { model: MODEL, at: new Date().toISOString(), report, log };
mkdirSync(resolve(ROOT, 'test-results/ab'), { recursive: true });
writeFileSync(resolve(ROOT, 'test-results/ab/7b-fix-run.json'), JSON.stringify(out, null, 2));
console.log(log.join('\n'));
console.log('\n=== REPORT ===');
console.log(JSON.stringify(report, null, 2));
