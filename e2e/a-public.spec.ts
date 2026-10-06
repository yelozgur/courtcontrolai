import type { Response } from '@playwright/test';
import { test, expect, probe, expectRendered } from './helpers';

/**
 * Public surface smoke tests — marketing, auth and discovery routes that
 * must render for anonymous visitors.
 */
test.describe('A — public routes', () => {
  test('A01 home page renders visible text without a framework error', async ({ page }) => {
    const result = await probe(page, '/');
    expectRendered(result, 'A01 /');
    expect(result.textLength).toBeGreaterThan(0);
  });

  test('A02 login page renders and contains the Turkish sign-in heading', async ({ page }) => {
    const result = await probe(page, '/login');
    expectRendered(result, 'A02 /login');
    expect(result.visibleText).toContain('Giriş Yap');
  });

  test('A03 login page exposes at least one input field', async ({ page }) => {
    const result = await probe(page, '/login');
    expectRendered(result, 'A03 /login inputs');
    expect(result.inputCount).toBeGreaterThanOrEqual(1);
  });

  test('A04 signup page renders visible text', async ({ page }) => {
    const result = await probe(page, '/signup');
    expectRendered(result, 'A04 /signup');
    expect(result.textLength).toBeGreaterThan(0);
  });

  test('A05 tournaments list page renders visible text', async ({ page }) => {
    const result = await probe(page, '/tournaments');
    expectRendered(result, 'A05 /tournaments');
    expect(result.textLength).toBeGreaterThan(0);
  });

  test('A06 new tournament page renders visible text', async ({ page }) => {
    const result = await probe(page, '/tournaments/new');
    expectRendered(result, 'A06 /tournaments/new');
    expect(result.textLength).toBeGreaterThan(0);
  });

  test('A07 sponsors page renders visible text', async ({ page }) => {
    const result = await probe(page, '/sponsors');
    expectRendered(result, 'A07 /sponsors');
    expect(result.textLength).toBeGreaterThan(0);
  });

  test('A08 arena page renders visible text', async ({ page }) => {
    const result = await probe(page, '/arena');
    expectRendered(result, 'A08 /arena');
    expect(result.textLength).toBeGreaterThan(0);
  });

  test('A09 home page has a non-empty document title that is stable across loads', async ({ page }) => {
    const first = await probe(page, '/');
    const second = await probe(page, '/');

    expect(first.title.trim().length, 'A09 first load title').toBeGreaterThan(0);
    expect(second.title.trim().length, 'A09 second load title').toBeGreaterThan(0);
    expect(second.title, 'A09 title must be stable across two loads').toBe(first.title);
  });

  test('A10 login page renders without any uncaught console error', async ({ page }) => {
    const result = await probe(page, '/login');
    expectRendered(result, 'A10 /login console');
    expect(result.consoleErrors, `A10 console errors: ${result.consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('A11 tournaments page issues no 5xx request to a firestore or firebase host', async ({ page }) => {
    const serverErrors: string[] = [];
    const onResponse = (response: Response) => {
      const url = response.url();
      const isDataHost = /firestore|firebase/i.test(url);
      if (isDataHost && response.status() >= 500) {
        serverErrors.push(`${response.status()} ${url.slice(0, 160)}`);
      }
    };

    page.on('response', onResponse);
    try {
      const result = await probe(page, '/tournaments');
      expectRendered(result, 'A11 /tournaments network');
    } finally {
      page.off('response', onResponse);
    }

    // Deliberately NOT weakened: a Firestore proxy 5xx here is a real finding.
    expect(
      serverErrors,
      `A11 firestore/firebase requests returned 5xx:\n${serverErrors.join('\n')}`,
    ).toEqual([]);
  });

  test('A12 home page logs no hydration error', async ({ page }) => {
    const result = await probe(page, '/');
    expectRendered(result, 'A12 / hydration');

    const hydrationErrors = result.consoleErrors.filter((message) =>
      /hydrat/i.test(message),
    );
    expect(
      hydrationErrors,
      `A12 hydration errors: ${hydrationErrors.join(' | ')}`,
    ).toEqual([]);
  });
});
