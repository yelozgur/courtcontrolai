import { test, expect, probe, expectNoSecretLeak } from './helpers';

/**
 * E — unauthenticated data-exposure checks.
 *
 * FRAMING (important, do not "simplify" this away):
 * CourtControl AI is a client-rendered Next.js SPA. There is NO src/middleware.ts
 * and the dashboard guard is client-side only (src/app/dashboard/layout.tsx ends
 * with `if (!user) return null;`).
 *
 * That means:
 *   - A 200 response for a /dashboard* URL is NOT by itself a breach. The server
 *     only ever ships the app shell; privileged data is fetched client-side by
 *     Firebase after the browser proves an auth state.
 *   - A breach is *privileged DATA reaching an anonymous visitor*: user emails,
 *     club rosters, cost totals, marketing queue rows, participant PII, or a
 *     user-record payload from the Firestore proxy.
 *
 * So every assertion below checks for DATA, never for HTTP status alone. Where
 * the app is genuinely safe today (empty shell, no data), the test asserts that
 * safe behaviour and passes. If one of these fails, it is a real finding and
 * must not be weakened.
 */

// ---------------------------------------------------------------------------
// File-local detection patterns. Deliberately NOT extracted into another module:
// helpers.ts is owned elsewhere and these patterns are specific to this spec.
// ---------------------------------------------------------------------------

/** Any syntactically valid email address. */
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/**
 * Placeholder e-mail literals that ship inside HTML attributes (input
 * placeholders, sample values, docs). `name@example.com` is the HTML5
 * convention and appears in the login form on every page that renders one,
 * so scanning raw HTML for it is a guaranteed false positive.
 */
const PLACEHOLDER_EMAILS = [
  'name@example.com',
  'email@example.com',
  'user@example.com',
  'you@example.com',
  'john@example.com',
  'test@example.com',
  'ornek@email.com',
];

/**
 * Remove markup before scanning HTML for PII. Attribute values (placeholders,
 * `type="email"`, `name="email"`) are not leaked data, and React's serialised
 * Flight payload is not user content.
 */
const htmlToScannableText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ') // drop all tags, keeping only text nodes
    .replace(/\s+/g, ' ');

const dropPlaceholderEmails = (s: string): string => {
  let out = s;
  for (const placeholder of PLACEHOLDER_EMAILS) {
    out = out.split(placeholder).join(' ');
  }
  return out;
};

/**
 * Currency figures — deliberately STRICT.
 *
 * A naive /\$\s?\d/ is unusable here: Next.js dev mode inlines React Flight
 * payload markers ("$3", "$4", "$5", ...) into every HTML shell, which matches
 * that pattern on every page and produces a guaranteed false positive.
 * A real money figure is either a decimal ($20.00), grouped ($1,200), a
 * non-USD symbol, or spelled out (EUR 120 / 1.250 TL).
 */
const CURRENCY_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'currency symbol + digits (₺/€/£)', re: /[₺€£]\s?\d/ },
  { label: 'decimal amount ($20.00)', re: /\$\s?\d+[.,]\d{2}\b/ },
  { label: 'grouped amount ($1,200)', re: /\$\s?\d{1,3}(?:[.,]\d{3})+/ },
  { label: 'spelled-out EUR amount', re: /\bEUR\s?\d/i },
  { label: 'spelled-out TL amount', re: /\b\d[\d.,]*\s?TL\b/i },
  // A bare grouped number needs at least two thousands groups AND a real
  // magnitude: "1,234,567.89". A single group is CSS colour noise
  // ("255,255,255"), a byte offset ("41,102") or a version string ("6.219").
  // Colour literals are stripped by stripCssColors() before scanning, because
  // `\b` makes "255,255,255" inside rgba() look like a plain number.
  { label: 'grouped money amount without symbol', re: /\b\d{1,3}(?:,\d{3}){2,}(?:[.,]\d{2})?\b/ },
];

/** Inline CSS colour literals, which are numeric but never money. */
const stripCssColors = (s: string): string =>
  s.replace(/rgba?\([^)]*\)/g, ' ').replace(/#[0-9a-f]{3,8}\b/gi, ' ');

/** Personally identifiable data that must never render for an anonymous visitor. */
const PII_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'email address', re: EMAIL_PATTERN },
  { label: 'Turkish mobile number', re: /(?:\+90|\b0)?5\d{9}\b/ },
  { label: 'Turkish national ID (TCKN)', re: /\b\d{11}\b/ },
  { label: 'IBAN', re: /\bTR\d{2}[A-Z0-9]{20,26}\b/ },
];

/** Keys that only appear when real user records are serialised into a response. */
const USER_RECORD_KEYS = ['"email":', '"uid":', '"displayName":', '"photoURL":', '"emailVerified"'];

/** Chrome that only renders for a signed-in user. */
const AUTHENTICATED_MARKERS = [/sign out/i, /çıkış/i, /log ?out/i, /manage your club/i, /profilim/i];

/** Runs a labelled pattern list against a body and returns every offending match. */
function scan(text: string, patterns: { label: string; re: RegExp }[]): string[] {
  return patterns.flatMap(({ label, re }) => {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    return (text.match(global) ?? []).map((hit) => `${label} -> "${hit.trim()}"`);
  });
}

/** Raw server HTML for the current page — the surface that could leak via SSR. */
async function rawHtml(page: import('@playwright/test').Page): Promise<string> {
  return page.content();
}

test.describe('E1 — privileged data must not reach an anonymous visitor', () => {
  test('E01 /dashboard unauthenticated exposes no authenticated content or PII', async ({ page }, testInfo) => {
    const result = await probe(page, '/dashboard', 2500);
    const html = await rawHtml(page);
    const text = result.visibleText;

    // Record the CURRENT auth behaviour: redirect to /login, a rendered auth
    // gate, or a bare 200 shell with no guard UI at all.
    const observed =
      result.finalUrl.startsWith('/login')
        ? 'redirected to /login'
        : text.length === 0
          ? 'HTTP 200 empty shell (client-side guard rendered nothing, no auth gate UI)'
          : 'HTTP 200 with rendered gate/content';
    testInfo.annotations.push({ type: 'auth-behaviour', description: observed });

    // Scan the rendered TEXT (not raw HTML) so input placeholders and React's
    // serialised Flight payload cannot masquerade as a leak.
    const scannableHtml = dropPlaceholderEmails(htmlToScannableText(html));

    // The 200 status itself is NOT a breach — assert on the DATA instead.
    expect(scan(text, PII_PATTERNS), `E01 unauthenticated /dashboard leaked PII (${observed})`).toEqual([]);
    expect(
      scan(
        scannableHtml,
        USER_RECORD_KEYS.map((key) => ({ label: `user record key ${key}`, re: new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') })),
      ),
      `E01 unauthenticated /dashboard serialised user records (${observed})`,
    ).toEqual([]);

    const authChrome = AUTHENTICATED_MARKERS.filter((re) => re.test(text)).map((re) => String(re));
    expect(authChrome, `E01 unauthenticated /dashboard rendered authenticated chrome (${observed})`).toEqual([]);

    // Server-side secrets must never be echoed into the shell either.
    expectNoSecretLeak(html);
  });

  test('E02 /dashboard/admin/users unauthenticated contains no email address or user records', async ({ page }) => {
    const result = await probe(page, '/dashboard/admin/users', 2500);
    const html = await rawHtml(page);

    expect(result.visibleText.match(EMAIL_PATTERN) ?? [], 'E02 admin/users leaked an email address').toEqual([]);
    expect(
      scan(dropPlaceholderEmails(htmlToScannableText(html)), PII_PATTERNS),
      'E02 admin/users leaked PII into the server shell',
    ).toEqual([]);
    expect(
      USER_RECORD_KEYS.filter((key) => html.includes(key)),
      'E02 admin/users serialised user records into the HTML',
    ).toEqual([]);
  });

  test('E03 /dashboard/admin/clubs unauthenticated contains no club member data', async ({ page }) => {
    const result = await probe(page, '/dashboard/admin/clubs', 2500);
    const html = await rawHtml(page);

    expect(scan(result.visibleText, PII_PATTERNS), 'E03 admin/clubs leaked club member PII').toEqual([]);
    expect(
      scan(dropPlaceholderEmails(htmlToScannableText(html)), PII_PATTERNS),
      'E03 admin/clubs leaked club member PII into the server shell',
    ).toEqual([]);
    // A rendered club registry always pairs a label with a member count.
    expect(
      result.visibleText.match(/\b\d+\s+(üye|member| Kulüp|clubs?)\b/gi) ?? [],
      'E03 admin/clubs leaked club member counts',
    ).toEqual([]);
  });

  test('E04 /dashboard/admin/costs unauthenticated contains no currency totals', async ({ page }) => {
    const result = await probe(page, '/dashboard/admin/costs', 2500);
    const html = await rawHtml(page);

    // CSS colour literals ("rgba(255,255,255,1)") are numeric but are styling,
    // not money. Strip them before scanning so a white background is not
    // reported as a leaked currency total.
    expect(
      scan(stripCssColors(result.visibleText), CURRENCY_PATTERNS),
      'E04 admin/costs rendered a currency total'
    ).toEqual([]);
    expect(
      scan(stripCssColors(html), CURRENCY_PATTERNS),
      'E04 admin/costs leaked a currency total into the server shell'
    ).toEqual([]);
  });

  test('E05 /dashboard/admin/marketing/queue unauthenticated contains no marketing queue entries', async ({ page }) => {
    const result = await probe(page, '/dashboard/admin/marketing/queue', 2500);
    const html = await rawHtml(page);

    expect(scan(result.visibleText, PII_PATTERNS), 'E05 marketing/queue leaked recipient PII').toEqual([]);
    expect(
      scan(dropPlaceholderEmails(htmlToScannableText(html)), PII_PATTERNS),
      'E05 marketing/queue leaked recipient PII into the server shell',
    ).toEqual([]);
    // Campaign/queue payloads are the leak shape: a subject line plus a schedule state.
    const queuePayloadKeys = ['"subject":', '"campaign":', '"scheduledAt":', '"recipient":', '"audience":'];
    expect(
      queuePayloadKeys.filter((key) => html.includes(key)),
      'E05 marketing/queue serialised campaign entries into the HTML',
    ).toEqual([]);
    expect(
      result.visibleText.match(/\b(scheduled|scheduledFor|zamanlanmış|draft|taslak)\b/gi) ?? [],
      'E05 marketing/queue rendered queue entry state',
    ).toEqual([]);
  });

  test('E06 /dashboard/participants unauthenticated contains no participant PII', async ({ page }) => {
    const result = await probe(page, '/dashboard/participants', 2500);
    const html = await rawHtml(page);

    expect(scan(result.visibleText, PII_PATTERNS), 'E06 participants leaked participant PII').toEqual([]);
    expect(
      scan(dropPlaceholderEmails(htmlToScannableText(html)), PII_PATTERNS),
      'E06 participants leaked participant PII into the server shell',
    ).toEqual([]);
    expect(
      result.visibleText.match(/\b(tc kimlik|tc no|kimlik no|doğum tarihi|dob)\b/gi) ?? [],
      'E06 participants rendered identity fields',
    ).toEqual([]);
  });

  test('E08 /dashboard/admin/costs unauthenticated renders no numeric currency figure', async ({ page }) => {
    const result = await probe(page, '/dashboard/admin/costs', 2500);
    const text = stripCssColors(result.visibleText);

    expect(scan(text, CURRENCY_PATTERNS), `E08 costs rendered a numeric currency figure (text: "${text.slice(0, 120)}")`).toEqual([]);
    // A money amount printed without its symbol still leaks the figure.
    // Same tightening as CURRENCY_PATTERNS: two or more thousands groups, so
    // CSS rgba() and byte offsets are not mistaken for money.
    expect(
      text.match(/\b\d{1,3}(?:,\d{3}){2,}(?:[.,]\d{2})?\b/g) ?? [],
      'E08 costs rendered a grouped monetary figure',
    ).toEqual([]);
  });
});

test.describe('E2 — API, client-side session and transport exposure', () => {
  test('E07 GET /api/firestore/users unauthenticated returns no user records', async ({ page }) => {
    const response = await page.request.get('/api/firestore/users');
    const body = await response.text();

    expectNoSecretLeak(body);

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }

    // A leaked payload would be an array of user documents (possibly wrapped).
    expect(Array.isArray(parsed), `E07 /api/firestore/users returned a top-level JSON array: ${body.slice(0, 200)}`).toBe(false);

    const containers = [parsed, (parsed as { users?: unknown } | null)?.users, (parsed as { data?: unknown } | null)?.data];
    const records = containers.filter((value): value is unknown[] => Array.isArray(value));
    for (const list of records) {
      expect(list.length, `E07 /api/firestore/users returned ${list.length} user record(s)`).toBe(0);
    }

    expect(body.match(EMAIL_PATTERN) ?? [], 'E07 /api/firestore/users leaked an email address').toEqual([]);
    expect(
      USER_RECORD_KEYS.filter((key) => body.includes(key)),
      'E07 /api/firestore/users leaked user record fields',
    ).toEqual([]);
    // A non-2xx proxy error is acceptable; a 2xx response carrying data is not.
    expect(
      response.ok() && body.length > 0 && Array.isArray(parsed),
      'E07 /api/firestore/users returned 2xx with a JSON payload while unauthenticated',
    ).toBe(false);
  });

  test('E09 /login exposes no auth token or session cookie to client JavaScript', async ({ page }) => {
    const result = await probe(page, '/login', 2000);
    expectRenderedLogin(result);

    const exposure = await page.evaluate(() => {
      const cookies = document.cookie ?? '';
      const storage: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key) storage.push(`${key}=${localStorage.getItem(key) ?? ''}`);
      }
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key) storage.push(`${key}=${sessionStorage.getItem(key) ?? ''}`);
      }
      return { cookies, storage };
    });

    // Firebase keeps its real token in IndexedDB; an HttpOnly cookie or a token
    // in web storage would mean the credential is readable from client JS.
    expect(exposure.cookies, 'E09 session cookie exposed to document.cookie').not.toMatch(
      /session|token|auth|jwt|refresh|\bsid\b|__session/i,
    );
    expect(exposure.cookies, 'E09 a JWT-shaped value is readable from document.cookie').not.toMatch(
      /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/,
    );
    expect(
      exposure.cookies.split(';').map((part) => part.trim()).filter((part) => /^[A-Za-z0-9_-]{20,}=/.test(part)),
      'E09 an opaque high-entropy session value is readable from document.cookie',
    ).toEqual([]);
    expect(
      exposure.storage.filter((entry) => /session|token|auth|jwt|refresh/i.test(entry.split('=')[0] ?? '')),
      'E09 a token-like key is present in web storage',
    ).toEqual([]);
  });

  test('E10 /dashboard sets no permissive CORS header for a foreign origin', async ({ page }) => {
    const foreignOrigin = 'https://evil.example';
    const response = await page.request.get('/dashboard', { headers: { Origin: foreignOrigin } });
    const headers = response.headers();
    const allowOrigin = headers['access-control-allow-origin'];

    expect(
      allowOrigin === undefined || (allowOrigin !== '*' && allowOrigin !== foreignOrigin),
      `E10 /dashboard allows a foreign origin: access-control-allow-origin=${allowOrigin ?? '<absent>'}`,
    ).toBe(true);

    // A reflected origin is only safe without credentialed access.
    if (allowOrigin === foreignOrigin) {
      expect(headers['access-control-allow-credentials'], 'E10 reflected origin plus credentialed CORS').not.toBe('true');
    }
  });
});

/** Minimal local render check — kept here so E09 does not depend on other specs. */
function expectRenderedLogin(result: Awaited<ReturnType<typeof probe>>) {
  expect(result.status, 'E09 /login HTTP status').toBe(200);
  expect(result.textLength, 'E09 /login rendered nothing').toBeGreaterThan(0);
}
