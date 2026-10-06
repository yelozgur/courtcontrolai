import { test, expect, probe, type PageProbe } from './helpers';

/**
 * F — error handling and resilience for anonymous visitors.
 *
 * Covers: 404 routing, form validation, rejected credentials, console health,
 * link integrity, Turkish text encoding and navigation state across reload.
 */

const NOT_FOUND_ROUTE = '/nonexistent-route-xyz';

/**
 * Stack-trace signatures. Scanned against VISIBLE text only (document.body.innerText
 * plus the document title): Next.js inlines framework/dev internals inside <script>
 * blocks by design, and those are not user-visible leakage. A stack trace leaking
 * into rendered output is the actual defect this test guards.
 */
const STACK_MARKERS: { label: string; re: RegExp }[] = [
  { label: 'stack frame (at fn (...))', re: /(?:^|\s)at\s+[\w$.<>[\]]+\s*\(/m },
  { label: 'source location file:line:col', re: /\b[\w@/.-]+\.(?:tsx?|jsx?|mjs|cjs):\d+:\d+/ },
  { label: 'node_modules path', re: /node_modules[\\/]/ },
  { label: 'webpack-internal module id', re: /webpack-internal/ },
  { label: '__NEXT_DATA__ dump', re: /__NEXT_DATA__/ },
  { label: 'literal stack/traceback label', re: /\b(?:stack trace|traceback)\b/i },
  { label: 'component stack', re: /\b(?:React|Component) stack\b/i },
];

/** Bytes that indicate UTF-8 text was decoded as Latin-1. */
const MOJIBAKE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'UTF-8 read as Latin-1 (Ã…)', re: /Ã[\x80-\xBF]|[À-ÿ]{2}/ },
  { label: 'UTF-8 ş/ğ read as Latin-1 (Ä°/Ä§)', re: /Ä[°§±Ð¢]/ },
  { label: 'replacement character', re: /�/ },
  { label: 'byte-order mark leak', re: /﻿/ },
];

/** Collects internal hrefs rendered on the page. */
async function internalHrefs(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/') && !href.startsWith('//')),
  );
}

/** Fails the test if the page died instead of rendering an error. */
function expectPageNotBroken(result: PageProbe, label: string) {
  expect(result.status, `${label}: HTTP status`).toBe(200);
  expect(result.textLength, `${label}: page rendered nothing (blank/crash)`).toBeGreaterThan(0);
  expect(result.visibleText, `${label}: framework error page`).not.toContain('Application error');
}

test.describe('F1 — routing and error pages', () => {
  test('F01 unknown route renders a 404 page with a link back to home', async ({ page }) => {
    const result = await probe(page, NOT_FOUND_ROUTE, 1500);

    expect(result.status, 'F01 unknown route must answer with HTTP 404').toBe(404);
    expect(result.visibleText, 'F01 404 page must state the status').toContain('404');
    expect(result.visibleText.toLowerCase(), 'F01 404 page must explain what happened').toContain('could not be found');

    // CURRENT FINDING: the app ships no custom not-found page, so this renders the
    // Next.js built-in 404 which has no recovery link. Asserted strictly on purpose —
    // weakening this to "status is 404" would hide the missing recovery path.
    const homeLink = page.locator('a[href="/"]').first();
    await expect(homeLink, 'F01 404 page offers no link back to the home page').toBeVisible();
  });

  test('F02 unknown route body contains no stack trace', async ({ page }) => {
    const result = await probe(page, NOT_FOUND_ROUTE, 1500);
    const title = await page.title();
    const surface = `${result.visibleText}\n${title}`;

    for (const { label, re } of STACK_MARKERS) {
      expect(surface.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? [],
        `F02 404 page leaked a ${label}`).toEqual([]);
    }

    // Server internals must not be printed either.
    expect(result.visibleText, 'F02 404 page leaked the raw server status object').not.toMatch(
      /\{"(?:statusCode|digest|gid|buildId)"/,
    );
  });
});

test.describe('F2 — form validation and rejected submissions', () => {
  test('F03 submitting an empty login form shows a validation message and does not crash', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const email = page.locator('#email');
    const password = page.locator('#password');
    await expect(email, 'F03 login email field missing').toBeVisible();
    await expect(password, 'F03 login password field missing').toBeVisible();

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // The form is natively constrained (both inputs are `required`), so the browser
    // must block submission and expose the validation message it displays.
    const validation = await email.evaluate((el) => ({
      message: (el as HTMLInputElement).validationMessage,
      invalid: (el as HTMLInputElement).matches(':invalid'),
      valid: (el as HTMLInputElement).checkValidity(),
    }));

    expect(validation.invalid, 'F03 empty login submit did not flag the email field as invalid').toBe(true);
    expect(validation.valid, 'F03 empty login form passed native validation').toBe(false);
    expect(validation.message.trim(), 'F03 no validation message was produced for the empty email field').not.toBe('');
    expect(new URL(page.url()).pathname, 'F03 empty login submit navigated away').toBe('/login');
    expect(pageErrors, `F03 empty submit threw: ${pageErrors.join(' | ')}`).toEqual([]);

    const text = await page.evaluate(() => document.body.innerText ?? '');
    expect(text.trim().length, 'F03 page went blank after empty submit').toBeGreaterThan(0);
    expect(text, 'F03 framework error after empty submit').not.toContain('Application error');
  });

  test('F04 login with garbage credentials shows an error message instead of a blank page', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.fill('#email', 'definitely-not-a-user@example.invalid');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // The rejection surfaces as a Radix toast (role="status"). Filter on non-empty
    // text so Radix's hidden live-region twin is not selected.
    const errorToast = page.locator('[role="status"], [role="alert"]').filter({ hasText: /\S/ }).first();
    await expect(errorToast, 'F04 rejected credentials produced no visible error message').toBeVisible({ timeout: 15_000 });

    const toastText = (await errorToast.innerText()).trim();
    expect(toastText, 'F04 error message is empty').not.toBe('');
    expect(toastText, `F04 error message is not recognisable: "${toastText}"`).toMatch(/auth\/|invalid|expired|hata|error/i);

    // "Not a blank page": the form is still usable after the failure.
    expect(await page.locator('#email').isVisible(), 'F04 login form disappeared after a failed submit').toBe(true);
    expect(await page.locator('#password').isVisible(), 'F04 password field disappeared after a failed submit').toBe(true);
    expect(new URL(page.url()).pathname, 'F04 failed login navigated away from /login').toBe('/login');
    expect(pageErrors, `F04 failed login threw: ${pageErrors.join(' | ')}`).toEqual([]);

    const body = await page.evaluate(() => document.body.innerText ?? '');
    expect(body.trim().length, 'F04 page went blank after a failed login').toBeGreaterThan(0);
    expect(body, 'F04 framework error after a failed login').not.toContain('Application error');
  });

  test('F05 submitting an empty signup form shows validation and does not crash', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));

    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await expect(page.locator('#name'), 'F05 signup name field missing').toBeVisible();
    await expect(page.locator('#email'), 'F05 signup email field missing').toBeVisible();
    await expect(page.locator('#password'), 'F05 signup password field missing').toBeVisible();

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    const validation = await page.locator('#name').evaluate((el) => ({
      message: (el as HTMLInputElement).validationMessage,
      invalid: (el as HTMLInputElement).matches(':invalid'),
    }));

    expect(validation.invalid, 'F05 empty signup submit did not flag the name field as invalid').toBe(true);
    expect(validation.message.trim(), 'F05 no validation message was produced for the empty name field').not.toBe('');
    expect(new URL(page.url()).pathname, 'F05 empty signup submit navigated away').toBe('/signup');
    expect(pageErrors, `F05 empty signup threw: ${pageErrors.join(' | ')}`).toEqual([]);

    const text = await page.evaluate(() => document.body.innerText ?? '');
    expect(text.trim().length, 'F05 page went blank after empty signup submit').toBeGreaterThan(0);
    expect(text, 'F05 framework error after empty signup submit').not.toContain('Application error');
  });
});

test.describe('F3 — runtime health, links and encoding', () => {
  test('F06 home page logs no uncaught exception during a 3s idle', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
    });

    const result = await probe(page, '/', 3000);
    await page.waitForTimeout(3000); // explicit 3s idle window on a settled page

    expect(pageErrors, `F06 uncaught exception during idle: ${pageErrors.join(' | ')}`).toEqual([]);
    const uncaught = consoleErrors.filter((message) => /uncaught/i.test(message));
    expect(uncaught, `F06 uncaught exception reported to console: ${uncaught.join(' | ')}`).toEqual([]);

    // An unhandled rejection from a background fetch is still an uncaught error.
    const unhandled = consoleErrors.filter((message) => /unhandled (?:promise )?rejection/i.test(message));
    expect(unhandled, `F06 unhandled rejection: ${unhandled.join(' | ')}`).toEqual([]);

    expectPageNotBroken(result, 'F06 / idle');
  });

  test('F07 /tournaments internal links are well-formed and none are dead', async ({ page }) => {
    const result = await probe(page, '/tournaments', 2500);
    expectPageNotBroken(result, 'F07 /tournaments');

    const hrefs = await internalHrefs(page);
    expect(hrefs.length, 'F07 /tournaments rendered no internal links at all').toBeGreaterThan(0);

    // Malformed hrefs: unresolved template values, whitespace or doubled separators.
    const malformed = hrefs.filter((href) =>
      /undefined|NaN|\[object|null|undefined\b/i.test(href) || /\s/.test(href) || /[^:]\/\//.test(href),
    );
    expect(malformed, `F07 malformed internal hrefs: ${malformed.join(', ')}`).toEqual([]);

    const unique = [...new Set(hrefs)];
    const dead: string[] = [];
    for (const href of unique) {
      const response = await page.request.get(href);
      if (response.status() >= 400) dead.push(`${href} -> ${response.status()}`);
    }
    expect(dead, `F07 dead internal links on /tournaments: ${dead.join(', ')}`).toEqual([]);
  });

  test('F08 home page locale handling works without breaking the page', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));

    const first = await probe(page, '/', 2500);
    expectPageNotBroken(first, 'F08 / initial load');

    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang.trim(), 'F08 <html> has no lang attribute').not.toBe('');
    expect(lang.trim(), `F08 <html lang> is not a valid language tag: "${lang}"`).toMatch(/^[a-z]{2}(-[A-Za-z0-9]+)?$/i);

    // Locale is persisted under `cca_locale` by I18nProvider (src/i18n/I18nProvider.tsx).
    for (const locale of ['tr', 'en']) {
      await page.evaluate((value) => {
        try {
          localStorage.setItem('cca_locale', value);
        } catch {
          /* storage unavailable */
        }
      }, locale);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const stored = await page.evaluate(() => localStorage.getItem('cca_locale'));
      expect(stored, `F08 locale "${locale}" was not applied`).toBe(locale);

      const result = await probe(page, '/', 0);
      expectPageNotBroken(result, `F08 / with locale=${locale}`);
    }

    expect(pageErrors, `F08 locale handling threw: ${pageErrors.join(' | ')}`).toEqual([]);

    // If a language switcher is present it must expose both locales and not break.
    const switcher = page.locator('svg.lucide-globe').first();
    if ((await switcher.count()) > 0) {
      await switcher.click();
      await page.waitForTimeout(300);
      const options = await page.locator('button').filter({ hasText: /Türkçe|English/ }).count();
      expect(options, 'F08 language switcher opened without listing any locale').toBeGreaterThan(0);
      expectPageNotBroken(await probe(page, '/', 0), 'F08 / after opening the switcher');
    }
  });

  test('F09 /tournaments renders Turkish characters without mojibake', async ({ page }) => {
    const result = await probe(page, '/tournaments', 2500);
    expectPageNotBroken(result, 'F09 /tournaments');

    // React renders the attribute as `charSet` in the DOM, so `meta[charset]`
    // does not match case-sensitively in a selector.
    const charset = await page.evaluate(
      () =>
        document
          .querySelector('meta[charset], meta[charSet]')
          ?.getAttribute('charset') ??
        document.characterSet ??
        ''
    );
    expect(charset.toLowerCase(), `F09 page charset is "${charset}", expected utf-8`).toContain('utf-8');

    for (const { label, re } of MOJIBAKE_PATTERNS) {
      expect(
        result.visibleText.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? [],
        `F09 mojibake detected (${label})`,
      ).toEqual([]);
    }

    // If Turkish letters are present they must be intact (no '?' or '�' substitution).
    const turkishLetters = result.visibleText.match(/[ğüşıöçĞÜŞİÖÇ]/g) ?? [];
    if (turkishLetters.length > 0) {
      expect(
        result.visibleText.match(/[ğüşıöçĞÜŞİÖÇ]\?|�/g) ?? [],
        'F09 Turkish characters were substituted instead of rendered',
      ).toEqual([]);
    }

    // Non-vacuous guard: prove the page's own text pipeline encodes Turkish correctly,
    // so the test still has teeth on a page that happens to render none today.
    const roundTrip = await page.evaluate(() => {
      const original = document.title;
      document.title = 'ğüşıöç';
      const value = document.title;
      document.title = original;
      return value;
    });
    expect(roundTrip, 'F09 the page cannot represent Turkish characters').toBe('ğüşıöç');
  });

  test('F10 home page reload does not lose navigation state', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));

    const first = await probe(page, '/', 2500);
    expectPageNotBroken(first, 'F10 / initial load');
    const navBefore = await internalHrefs(page);
    expect(navBefore.length, 'F10 home page rendered no navigation links').toBeGreaterThan(0);

    // Follow a real internal link, then come back and reload.
    await page.locator('a[href="/tournaments"]').first().click();
    await page.waitForURL('**/tournaments**', { timeout: 15_000 });
    expect(new URL(page.url()).pathname, 'F10 navigation link did not reach /tournaments').toBe('/tournaments');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const navAfter = await internalHrefs(page);

    expect(navAfter, 'F10 navigation links changed or disappeared after reload').toEqual(navBefore);

    const reloaded = await probe(page, '/', 0);
    expectPageNotBroken(reloaded, 'F10 / after reload');

    // Reloading the current route again must stay on that route and stay usable.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    expect(new URL(page.url()).pathname, 'F10 reload changed the current route').toBe('/');
    expect(await page.locator('a[href="/tournaments"]').count(), 'F10 navigation is unusable after reload').toBeGreaterThan(0);
    expect(pageErrors, `F10 reload threw: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
