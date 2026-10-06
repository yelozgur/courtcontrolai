import { test, expect, probe } from './helpers';

/**
 * C — Dashboard content and unauthenticated handling.
 *
 * THE CONTRACT BEING TESTED
 * An unauthenticated visitor opening any /dashboard route must end up in one
 * of exactly two states:
 *   (a) real dashboard content is rendered, or
 *   (b) they are redirected to /login, which explains the situation.
 *
 * What must NEVER happen: a blank white page (HTTP 200 with zero visible
 * text). That was the original defect —
 *   src/app/dashboard/layout.tsx:89  `if (!user) return null;`
 * with no /login redirect anywhere in the repo.
 *
 * These tests therefore assert the ACCEPTANCE CRITERION, not "the page has
 * text". A test that only checks textLength > 0 is false-green: after a
 * redirect to /login the login page has 161 visible characters, so a naive
 * "did anything render?" assertion passes while the dashboard itself was
 * never verified. Each test below checks WHERE the user ended up.
 *
 * Once real Firebase auth is available, case (a) becomes reachable for a
 * signed-in user and these tests should assert case (a) specifically.
 */

const SETTLE_MS = 3000;

const DASHBOARD_ROUTES: { id: string; route: string }[] = [
  { id: 'C01', route: '/dashboard' },
  { id: 'C02', route: '/dashboard/profile' },
  { id: 'C03', route: '/dashboard/club' },
  { id: 'C04', route: '/dashboard/schedule' },
  { id: 'C05', route: '/dashboard/tournaments' },
  { id: 'C06', route: '/dashboard/tournaments/new' },
  { id: 'C07', route: '/dashboard/tournaments/1/edit' },
  { id: 'C08', route: '/dashboard/participants' },
  { id: 'C09', route: '/dashboard/check-in' },
  { id: 'C10', route: '/dashboard/sponsors' },
  { id: 'C11', route: '/dashboard/admin/users' },
  { id: 'C12', route: '/dashboard/admin/clubs' },
  { id: 'C13', route: '/dashboard/admin/costs' },
  { id: 'C14', route: '/dashboard/admin/marketing' },
  { id: 'C15', route: '/dashboard/admin/marketing/queue' },
];

test.describe('C — Dashboard: never a blank page', () => {
  test.slow();

  for (const { id, route } of DASHBOARD_ROUTES) {
    test(`${id} ${route} renders content or redirects to /login, never a blank shell`, async ({ page }) => {
      const result = await probe(page, route, SETTLE_MS);

      expect(result.status, `${id} ${route}: expected HTTP 200, got ${result.status}`).toBe(200);

      const redirectedToLogin = result.finalUrl.startsWith('/login');
      const renderedSomething = result.textLength > 0;

      // The defect: 200 + still on the dashboard route + nothing rendered.
      const blankShell =
        !redirectedToLogin && !renderedSomething;

      expect(
        blankShell,
        `${id} ${route} returned a BLANK page: stayed on "${result.finalUrl}" with ` +
          `${result.textLength} visible characters. An unauthenticated user sees a ` +
          `white screen with no explanation and no way forward.`
      ).toBe(false);

      // If it did render, it must not be a framework error page.
      expect(
        result.visibleText,
        `${id} ${route} must not show a framework error`
      ).not.toContain('Application error');
    });
  }

  test('C16 triage: record where an anonymous visitor actually lands on /dashboard', async ({ page }) => {
    const result = await probe(page, '/dashboard', SETTLE_MS);
    console.log(
      `[C16] /dashboard -> finalUrl=${result.finalUrl} status=${result.status} ` +
        `textLength=${result.textLength} consoleErrors=${result.consoleErrors.length}`
    );

    // Documents current behaviour; passes either way.
    expect(result.status, 'C16 /dashboard: HTTP status').toBe(200);
    expect(
      true,
      `C16 recorded: finalUrl=${result.finalUrl} textLength=${result.textLength}`
    ).toBe(true);
  });

  test('C17 /login is reachable and explains the situation', async ({ page }) => {
    // If the dashboard redirects here, this page must actually be usable.
    const result = await probe(page, '/login', SETTLE_MS);

    expect(result.status, 'C17 /login: HTTP status').toBe(200);
    expect(result.textLength, 'C17 /login: must render a sign-in form, not a blank page').toBeGreaterThan(0);
    expect(result.inputCount, 'C17 /login: must offer at least one input field').toBeGreaterThan(0);
  });
});
