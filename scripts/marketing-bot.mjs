#!/usr/bin/env node
/**
 * Marketing Bot — CourtControl AI
 *
 * Reads upcoming tournaments from Firestore, generates social media captions
 * via local LLM (MLX Phi-3.5-mini at :8081), saves to `marketing_queue` for
 * admin review.
 *
 * Idempotent: skips tournaments that already have today's marketing drafts.
 *
 * Usage:
 *   # Production (real Firebase)
 *   PROD_URL=https://firestore.googleapis.com/v1/projects/courtcontrolai-2294b/databases/(default)/documents \
 *   node scripts/marketing-bot.mjs
 *
 *   # Local emulator
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   GOOGLE_CLOUD_PROJECT=demo-app \
 *   node scripts/marketing-bot.mjs
 *
 * Exit codes:
 *   0 = success
 *   1 = partial failure (some tournaments failed)
 *   2 = total failure
 */

import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'marketing-bot.log');

const MLX_URL = process.env.MLX_URL || 'http://127.0.0.1:8081';
const ALIBABA_URL = process.env.ALIBABA_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const ALIBABA_KEY = process.env.ALIBABA_API_KEY;
const ALIBABA_MODEL = process.env.ALIBABA_MODEL || 'qwen-plus'; // qwen-turbo | qwen-plus | qwen-max

const FIRESTORE_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'courtcontrolai-2294b';
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const LOCALE_BATCH = ['tr', 'en', 'el']; // Cyprus multi-language
const LOOKAHEAD_DAYS = Number(process.env.MARKETING_LOOKAHEAD_DAYS || '14');

/**
 * Provider priority chain (best → worst):
 *   1. Alibaba Lite (qwen-plus) — best multilingual quality, token-budgeted
 *   2. MLX Qwen3.8-27B (:8080)  — high quality local (when not parked for RAM)
 *   3. MLX Phi-3.5-mini (:8081) — fastest local, weakest quality
 *
 * Detected via env vars (ALIBABA_API_KEY) + MLX endpoint reachability.
 */
let provider = null; // 'alibaba' | 'mlx-qwen' | 'mlx-phi'

async function detectProvider() {
  if (ALIBABA_KEY) return 'alibaba';
  try {
    const res = await fetch('http://127.0.0.1:8080/v1/models', { signal: AbortSignal.timeout(2000) });
    if (res.ok) return 'mlx-qwen';
  } catch { /* not running */ }
  try {
    const res = await fetch(`${MLX_URL}/v1/models`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return 'mlx-phi';
  } catch { /* not running */ }
  return null;
}

function log(level, msg, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    component: 'marketing-bot',
    msg,
    ...extra,
  });
  fs.appendFileSync(LOG_FILE, line + '\n');
  process.stderr.write(line + '\n');
}

/**
 * Fetch tournaments from Firestore REST API
 * We use raw REST to avoid firebase-admin SDK dependency on Node-only script.
 */
async function fetchUpcomingTournaments() {
  const useEmulator = !!FIRESTORE_EMULATOR;
  const baseUrl = useEmulator
    ? `http://${FIRESTORE_EMULATOR}/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`
    : `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

  // Firestore REST API query for upcoming registration_open tournaments
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'tournaments' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'IN',
          value: {
            arrayValue: {
              values: [
                { stringValue: 'registration_open' },
                { stringValue: 'registration_closed' },
              ],
            },
          },
        },
      },
      limit: 50,
      orderBy: [{ field: { fieldPath: 'startDate' }, direction: 'ASCENDING' }],
    },
  };

  try {
    const res = await fetch(`${baseUrl}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!res.ok) {
      const body = await res.text();
      log('error', 'firestore_query_failed', { status: res.status, body });
      return [];
    }
    const data = await res.json();
    // :runQuery returns an array of {document: {...}} or {found: null}
    const docs = Array.isArray(data) ? data : [];
    const tournaments = docs
      .filter((d) => d.document)
      .map((d) => {
        const f = d.document.fields;
        const fields = {};
        for (const [k, v] of Object.entries(f)) {
          fields[k] = Object.values(v)[0]; // stringValue, integerValue, etc.
        }
        return { id: d.document.name.split('/').pop(), ...fields };
      })
      .filter((t) => {
        // Filter to next LOOKAHEAD_DAYS
        if (!t.startDate) return false;
        const startMs = Date.parse(t.startDate);
        const now = Date.now();
        return startMs > now && startMs < now + LOOKAHEAD_DAYS * 86400_000;
      });
    log('info', 'tournaments_fetched', { count: tournaments.length });
    return tournaments;
  } catch (e) {
    log('error', 'firestore_query_error', { error: e.message });
    return [];
  }
}

/**
 * Generate caption via active provider.
 * Returns { tr, en, el } captions or null on failure.
 */
async function generateCaptions(tournament) {
  const prompt = `You are a sports marketing copywriter. Generate 3 short, engaging social media captions for the following tournament. Output as a JSON object with keys "tr", "en", "el" (Turkish, English, Greek).

Tournament:
- Name: ${tournament.name || 'Tournament'}
- Sport: ${tournament.sport || 'padel'}
- Start Date: ${tournament.startDate || 'TBD'}
- Location: ${JSON.stringify(tournament.locations) || 'TBD'}
- Description: ${tournament.description || ''}
- Entry Fee: ${tournament.entryFee || 0}
- Welcome Pack: ${tournament.hasWelcomePack ? 'Yes' : 'No'}

Each caption must:
- Be 1-2 sentences, max 200 chars
- Include 2-3 relevant hashtags
- Have an energetic, sports-focused tone
- Match the language's cultural context (Greek captions may include emojis, English should be globally appealing)

Respond ONLY with the JSON object. No preamble, no explanation, no markdown code fences.`;

  let url, headers, body, modelId;
  if (provider === 'alibaba') {
    url = `${ALIBABA_URL}/chat/completions`;
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ALIBABA_KEY}`,
    };
    modelId = ALIBABA_MODEL;
    body = JSON.stringify({
      model: ALIBABA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
  } else if (provider === 'mlx-qwen') {
    url = 'http://127.0.0.1:8080/v1/chat/completions';
    headers = { 'Content-Type': 'application/json' };
    modelId = 'qwen3.8-27b-mlx';
    body = JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
  } else {
    url = `${MLX_URL}/v1/chat/completions`;
    headers = { 'Content-Type': 'application/json' };
    modelId = 'phi-3.5-mini-mlx';
    body = JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      log('error', 'provider_request_failed', {
        provider, status: res.status, tournament: tournament.id, body: errBody.slice(0, 200),
      });
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    let captions;
    try {
      // Some providers wrap JSON in markdown code fences; strip them
      const cleanContent = content.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      captions = JSON.parse(cleanContent);
    } catch (e) {
      log('error', 'json_parse_failed', { tournament: tournament.id, content: content.slice(0, 300) });
      return null;
    }

    // Sanity check
    if (!captions.tr || !captions.en || !captions.el) {
      log('warn', 'partial_response', { tournament: tournament.id, captions });
      return null;
    }

    return captions;
  } catch (e) {
    log('error', 'provider_request_error', { provider, tournament: tournament.id, error: e.message });
    return null;
  }
}

/**
 * Save marketing queue entries to Firestore
 * One document per locale per tournament.
 */
async function saveToQueue(tournament, captions) {
  const useEmulator = !!FIRESTORE_EMULATOR;
  const baseUrl = useEmulator
    ? `http://${FIRESTORE_EMULATOR}/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`
    : `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const results = [];

  for (const locale of LOCALE_BATCH) {
    if (!captions[locale]) continue;

    // Idempotency check: query for existing doc with same tournament + locale + date
    const docId = `${tournament.id}_${locale}_${today}`;
    const checkUrl = `${baseUrl}/marketing_queue/${docId}`;

    try {
      const getRes = await fetch(checkUrl);
      if (getRes.status === 200) {
        log('info', 'duplicate_skipped', { tournament: tournament.id, locale });
        continue;
      }
    } catch (e) {
      // 404 = doesn't exist, continue. Other errors = abort.
      if (!String(e.message).includes('404')) {
        log('warn', 'duplicate_check_error', { error: e.message });
      }
    }

    // Create document
    const doc = {
      fields: {
        tournamentId: { stringValue: tournament.id },
        tournamentName: { stringValue: tournament.name || '' },
        sport: { stringValue: tournament.sport || '' },
        startDate: { stringValue: tournament.startDate || '' },
        locale: { stringValue: locale },
        caption: { stringValue: captions[locale] },
        status: { stringValue: 'pending_review' },
        generatedAt: { timestampValue: new Date().toISOString() },
        generatedBy: { stringValue: 'marketing-bot-v1' },
        model: { stringValue: 'phi-3.5-mini-mlx' },
        approvedBy: { stringValue: '' },
        approvedAt: { timestampValue: '' },
      },
    };

    try {
      const res = await fetch(checkUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      if (res.ok) {
        results.push({ locale, ok: true });
      } else {
        const body = await res.text();
        log('error', 'firestore_save_failed', { tournament: tournament.id, locale, status: res.status, body });
        results.push({ locale, ok: false });
      }
    } catch (e) {
      log('error', 'firestore_save_error', { tournament: tournament.id, locale, error: e.message });
      results.push({ locale, ok: false });
    }
  }

  return results;
}

async function main() {
  provider = await detectProvider();
  if (!provider) {
    log('error', 'no_provider_available', {
      alibaba_key_set: !!ALIBABA_KEY,
      mlx_qwen_8080: 'down',
      mlx_phi_8081: 'down',
    });
    process.exit(2);
  }
  log('info', 'provider_selected', { provider });

  log('info', 'bot_started', {
    mlx_url: MLX_URL,
    firestore_project: FIRESTORE_PROJECT,
    emulator: !!FIRESTORE_EMULATOR,
    lookahead_days: LOOKAHEAD_DAYS,
  });

  const tournaments = await fetchUpcomingTournaments();
  if (tournaments.length === 0) {
    log('info', 'no_upcoming_tournaments');
    process.exit(0);
  }

  let successCount = 0;
  let partialCount = 0;
  let failCount = 0;

  for (const t of tournaments) {
    log('info', 'processing_tournament', { id: t.id, name: t.name, start: t.startDate });
    const captions = await generateCaptions(t);
    if (!captions) {
      failCount++;
      continue;
    }
    const results = await saveToQueue(t, captions);
    const okCount = results.filter((r) => r.ok).length;
    if (okCount === LOCALE_BATCH.length) successCount++;
    else if (okCount > 0) partialCount++;
    else failCount++;

    log('info', 'tournament_done', {
      id: t.id,
      ok: okCount,
      failed: LOCALE_BATCH.length - okCount,
    });
  }

  log('info', 'bot_finished', {
    total: tournaments.length,
    success: successCount,
    partial: partialCount,
    failed: failCount,
  });

  if (failCount === tournaments.length) process.exit(2);
  if (failCount > 0 || partialCount > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  log('error', 'unhandled_error', { error: e.message, stack: e.stack });
  process.exit(2);
});
