import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/** Console errors + failed requests captured during a navigation. */
export interface PageProbe {
  status: number | null;
  finalUrl: string;
  visibleText: string;
  textLength: number;
  title: string;
  inputCount: number;
  buttonCount: number;
  consoleErrors: string[];
  failedRequests: string[];
  jsonBody: Record<string, unknown> | null;
}

/**
 * Navigate and let client-side hydration finish before measuring.
 * Live recon showed dashboard routes return an empty body until hydration
 * settles, so an immediate assertion would produce false failures.
 *
 * 2500ms (not 1500ms): when the full 68-test suite runs, the first pages of a
 * spec are compiled on demand by `next dev` and can miss a 1.5s settle window
 * while the same test passes in isolation. The extra second removes that
 * order-dependent flakiness without hiding a genuine empty shell.
 */
export async function probe(page: Page, route: string, settleMs = 2500): Promise<PageProbe> {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  const onConsole = (m: ConsoleMessage) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 250));
  };
  const onRequestFailed = (r: import('@playwright/test').Request) => {
    failedRequests.push(`${r.method()} ${r.url().slice(0, 120)}`);
  };

  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);

  let status: number | null = null;
  try {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    status = response?.status() ?? null;
  } catch {
    status = null;
  }
  await page.waitForTimeout(settleMs);

  let visibleText = '';
  let title = '';
  let inputCount = 0;
  let buttonCount = 0;
  let jsonBody: Record<string, unknown> | null = null;

  try {
    visibleText = (await page.evaluate(() => document.body?.innerText ?? '')).replace(/\s+/g, ' ').trim();
    title = await page.title();
    inputCount = await page.evaluate(() => document.querySelectorAll('input').length);
    buttonCount = await page.evaluate(() => document.querySelectorAll('button').length);
    try {
      const parsed = JSON.parse(visibleText);
      if (parsed && typeof parsed === 'object') jsonBody = parsed as Record<string, unknown>;
    } catch {
      /* not a JSON endpoint */
    }
  } catch {
    visibleText = '';
  }

  page.off('console', onConsole);
  page.off('requestfailed', onRequestFailed);

  return {
    status,
    finalUrl: new URL(page.url()).pathname,
    visibleText,
    textLength: visibleText.length,
    title,
    inputCount,
    buttonCount,
    consoleErrors,
    failedRequests,
    jsonBody,
  };
}

/** A page rendered real UI for the user — not an empty shell. */
export function expectRendered(probe: PageProbe, label: string) {
  expect(probe.status, `${label}: HTTP status`).toBe(200);
  expect(probe.textLength, `${label}: rendered text length (got "${probe.visibleText.slice(0, 80)}")`).toBeGreaterThan(0);
  expect(probe.visibleText, `${label}: must not show a framework error`).not.toContain('Application error');
}

/**
 * Server-side secrets must never be echoed to the client.
 *
 * This matches SECRET VALUES, not secret NAMES. A login form legitimately
 * renders `for="password"`, `id="password"` and `name="password"` in its
 * markup, so a name-based check fails on every page containing a sign-in form
 * while proving nothing. The patterns below all require a value shape.
 */
export function expectNoSecretLeak(body: string) {
  const forbidden: { label: string; re: RegExp }[] = [
    // Google API key: AIza + 35 chars
    { label: 'Google API key value', re: /AIza[0-9A-Za-z_-]{20,}/ },
    // Firebase private key material
    { label: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    // OpenAI-style secret key
    { label: 'sk- secret key', re: /\bsk-[0-9A-Za-z]{20,}/ },
    // Slack bot token
    { label: 'Slack bot token', re: /xoxb-[0-9A-Za-z-]{20,}/ },
    // Telegram bot token: 8-10 digits : 35 chars
    { label: 'Telegram bot token', re: /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/ },
    // Assignment of a secret-looking name to a literal value
    {
      label: 'secret assigned a literal value',
      re: /["']?(?:api[_-]?key|password|token|secret|private[_-]?key)["']?\s*[:=]\s*["'][^"']{12,}["']/i,
    },
  ];

  for (const { label, re } of forbidden) {
    const match = re.exec(body);
    expect(
      match,
      `response leaked a ${label}${match ? `: "${match[0].slice(0, 40)}..."` : ''}`,
    ).toBeNull();
  }
}

export { test, expect };
