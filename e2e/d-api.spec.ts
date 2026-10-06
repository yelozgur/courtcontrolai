/**
 * D — API contract / regression suite.
 *
 * Covers the JSON API surface: /api/health, /api/scheduler/solve,
 * /api/telegram/send, /api/telegram/test, /api/firestore/users.
 *
 * Assertions describe the INTENDED contract. Where the app currently
 * deviates (e.g. unhandled 500s on telegram/send and firestore proxying),
 * the test is expected to FAIL — that failure is the regression signal.
 *
 * Server is already running on :9002 (see playwright.config.ts — no webServer).
 */

import { test, expect, probe, expectNoSecretLeak } from './helpers';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9002';

test.describe('D01-D03 — GET /api/health', () => {
  test('D01: /api/health returns JSON with the documented top-level keys', async ({ page }) => {
    const p = await probe(page, '/api/health');

    expect(p.status, `/api/health: HTTP status (got "${p.visibleText.slice(0, 120)}")`).toBe(503);

    expect(p.jsonBody, '/api/health: body must be valid JSON').not.toBeNull();
    const body = p.jsonBody as Record<string, unknown>;

    // Contract keys. Note: there is intentionally NO top-level "status" key.
    for (const key of ['ok', 'timestamp', 'version', 'checks', 'uptime_s']) {
      expect(Object.keys(body), `/api/health: missing top-level key "${key}"`).toContain(key);
    }

    expect(typeof body.ok).toBe('boolean');
    expect(typeof body.version).toBe('string');
    expect(typeof body.timestamp).toBe('string');
    expect(Date.parse(String(body.timestamp)), '/api/health: timestamp must be ISO-8601').not.toBeNaN();
    expect(typeof body.uptime_s).toBe('number');
    expect(body.checks, '/api/health: "checks" must be an object').toBeTruthy();
    expect(typeof body.checks).toBe('object');
  });

  test('D02: /api/health reports the scheduler dependency as reachable', async ({ page }) => {
    const p = await probe(page, '/api/health');

    expect(p.jsonBody, '/api/health: body must be valid JSON').not.toBeNull();
    const checks = (p.jsonBody as Record<string, unknown>).checks as Record<string, unknown>;
    expect(checks, '/api/health: "checks" must be an object').toBeTruthy();

    const scheduler = checks.scheduler as Record<string, unknown>;
    expect(scheduler, '/api/health: checks.scheduler must be present').toBeTruthy();
    expect(
      scheduler.ok,
      `/api/health: checks.scheduler.ok (got ${JSON.stringify(scheduler)})`
    ).toBe(true);
    expect(
      typeof scheduler.latency_ms,
      `/api/health: checks.scheduler.latency_ms must be a number (got ${JSON.stringify(scheduler.latency_ms)})`
    ).toBe('number');
    expect(Number.isFinite(Number(scheduler.latency_ms))).toBe(true);
    expect(Number(scheduler.latency_ms)).toBeGreaterThanOrEqual(0);
  });

  test('D03: /api/health leaks no secret material', async ({ page }) => {
    const p = await probe(page, '/api/health');
    const body = p.visibleText;

    expect(body, '/api/health: body must be present').not.toBe('');

    // Helper covers the wider forbidden list (private keys, xoxb-, password, ...).
    expectNoSecretLeak(body);

    // Explicit guard on the standard credential prefixes.
    expect(body, '/api/health must not expose a Google API key').not.toContain('AIza');
    expect(body, '/api/health must not expose an OpenAI-style key').not.toContain('sk-');
  });
});

test.describe('D04-D06 — /api/scheduler/solve', () => {
  test('D04: GET /api/scheduler/solve is rejected as method-not-allowed', async ({ page }) => {
    const p = await probe(page, '/api/scheduler/solve');

    // Route is POST-only; Next.js must answer 405 for GET.
    expect(p.status, `/api/scheduler/solve GET: expected 405 (got ${p.status})`).toBe(405);
    expect(p.status, '/api/scheduler/solve GET: must be a 4xx client error').toBeGreaterThanOrEqual(400);
    expect(p.status, '/api/scheduler/solve GET: must be a 4xx client error').toBeLessThan(500);
  });

  test('D05: POST /api/scheduler/solve with an empty body returns 400, not 500', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/scheduler/solve`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status(), 'empty body must be a client error').toBe(400);
    expect(res.status(), 'empty body must never surface as an unhandled 500').not.toBe(500);

    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.error, 'error body must carry a string "error" field').toBe('string');
  });

  test('D06: POST /api/scheduler/solve accepts a valid payload and fails gracefully when the tournament is absent', async ({ request }) => {
    // Contract read from src/app/api/scheduler/solve/route.ts:
    //   body  { tournamentId: string, marginMinutes?: number }
    // The route reads the tournament, its `matches` and `courts` subcollections
    // from Firestore, then calls the standalone OR-Tools service.
    // A syntactically valid tournamentId that does not exist must produce a
    // HANDLED 4xx — never an unhandled 5xx, and never a hang.
    const payload = { tournamentId: 'e2e-nonexistent-tournament', marginMinutes: 30 };

    const res = await request.post(`${BASE_URL}/api/scheduler/solve`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });

    const status = res.status();
    expect(
      [200, 400, 404, 503],
      `valid-payload request must be handled with 200/400/404/503 (got ${status})`
    ).toContain(status);
    expect(
      status,
      'scheduler must never surface an unhandled 5xx for a missing tournament'
    ).not.toBe(500);

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (status === 200) {
      expect(Array.isArray(body.assignments), '200 must include an "assignments" array').toBe(true);
      expect(typeof body.makespan_minutes, '200 must include numeric "makespan_minutes"').toBe('number');
    } else {
      expect(typeof body.error, 'error response must carry a string "error" field').toBe('string');
    }
  });
});

test.describe('D07-D08 — /api/telegram/*', () => {
  test('D07: /api/telegram/send is POST-only and fails closed without credentials', async ({ page, request }) => {
    const p = await probe(page, '/api/telegram/send');
    expect(p.status, `/api/telegram/send GET: expected 405 (got ${p.status})`).toBe(405);

    // No bot token in env, none in body: must fail closed with a 4xx.
    const res = await request.post(`${BASE_URL}/api/telegram/send`, {
      data: { chatId: '@e2e_channel', message: 'E2E probe' },
      headers: { 'Content-Type': 'application/json' },
    });

    const status = res.status();
    expect(
      [400, 401, 403],
      `missing credentials must fail closed with 400/401/403 (got ${status})`
    ).toContain(status);
    expect(status, 'missing credentials must never surface as an unhandled 500').not.toBe(500);

    // The error body must be structured, and must not echo a bot token value.
    const body = (await res.json().catch(() => '')) as string;
    expect(body, 'error response must be JSON').not.toBe('');
    expect(String(body), 'error body must not contain a bot token value').not.toMatch(
      /\d{6,12}:[A-Za-z0-9_-]{30,}/
    );
  });

  test('D08: /api/telegram/test returns JSON without exposing a bot token', async ({ page }) => {
    const p = await probe(page, '/api/telegram/test');

    expect(p.status, `/api/telegram/test: HTTP status (got ${p.status})`).toBe(200);
    expect(p.jsonBody, '/api/telegram/test: body must be valid JSON').not.toBeNull();

    // Contract: the endpoint reports configuration STATUS, never the token itself.
    expect(typeof p.jsonBody?.status, 'must report a "status" field').toBe('string');
    expect(
      typeof p.jsonBody?.telegramConfigured,
      'must report a boolean "telegramConfigured"'
    ).toBe('boolean');

    const body = p.visibleText;
    // A real Telegram bot token is "<digits>:<35+ url-safe chars>".
    expect(body, '/api/telegram/test: must not contain a bot token value').not.toMatch(
      /\d{6,12}:[A-Za-z0-9_-]{30,}/
    );
  });
});

test.describe('D09-D10 — proxy + headers', () => {
  test('D09: /api/firestore/users returns a structured error, never a raw crash', async ({ page }) => {
    const p = await probe(page, '/api/firestore/users');

    // Intended contract: a handled, structured JSON error (4xx, or a 5xx that
    // still carries a structured JSON envelope) — never an HTML stack trace,
    // a raw Node exception dump, or an unhandled rejection.
    const body = p.visibleText;
    expect(body, '/api/firestore/users: must return a body').not.toBe('');
    expect(body, '/api/firestore/users: must not be an HTML error page').not.toMatch(/<\s*html/i);
    expect(body, '/api/firestore/users: must not be an HTML stack trace').not.toMatch(/at\s+\w+\s+\(/);
    expect(body, '/api/firestore/users: must not leak a raw unhandled exception').not.toMatch(
      /node:internal|internal\/[a-z-]+:\d+|unhandled (promise |rejection|exception)|Error:\s*\w+\s+at\s/i
    );

    expect(p.jsonBody, `/api/firestore/users: must be structured JSON (got "${body.slice(0, 160)}")`).not.toBeNull();
    const json = p.jsonBody as Record<string, unknown>;
    expect(typeof json.error, 'structured error body must carry a string "error" field').toBe('string');

    expect(
      p.status,
      `/api/firestore/users: must not be an unhandled 5xx (got ${p.status}: ${body.slice(0, 160)})`
    ).toBeLessThan(500);
  });

  test('D10: /api/health is served with a JSON Content-Type', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/health`);
    const contentType = res.headers()['content-type'] ?? '';

    expect(contentType, '/api/health: missing Content-Type header').not.toBe('');
    expect(
      contentType.toLowerCase(),
      `/api/health: Content-Type must be application/json (got "${contentType}")`
    ).toContain('application/json');
  });
});
