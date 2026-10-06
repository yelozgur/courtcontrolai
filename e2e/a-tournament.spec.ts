import { test, expect, probe, expectRendered } from './helpers';

/**
 * Tournament-scoped routes: bracket, standings, results, registration,
 * check-in plus the arena and referee surfaces for a single event.
 */
test.describe('B — tournament scoped routes', () => {
  test('B01 bracket page returns HTTP 200 and renders visible text', async ({ page }) => {
    const result = await probe(page, '/tournaments/1/bracket');
    expectRendered(result, 'B01 /tournaments/1/bracket');
    expect(result.textLength).toBeGreaterThan(20);
  });

  test('B02 bracket page shows a graceful empty state instead of a raw error', async ({ page }) => {
    const result = await probe(page, '/tournaments/1/bracket');
    expectRendered(result, 'B02 /tournaments/1/bracket empty state');

    const text = result.visibleText;
    const gracefulEmptyState =
      text.includes('Oluşturulmamış') ||
      text.includes('bracket tree will appear') ||
      text.includes('Bracket Tree');
    expect(gracefulEmptyState, `B02 expected a graceful empty state, got: ${text.slice(0, 160)}`).toBe(true);

    // A raw framework/runtime error must never be surfaced to the user.
    expect(text, 'B02 must not show "Application error"').not.toContain('Application error');
    expect(text, 'B02 must not show an unhandled runtime error').not.toContain(
      'Unhandled Runtime Error',
    );
    expect(text, 'B02 must not render an error object').not.toMatch(/TypeError|ReferenceError:/);
  });

  test('B03 leaderboard page returns HTTP 200 and renders visible text', async ({ page }) => {
    const result = await probe(page, '/tournaments/1/leaderboard');
    expectRendered(result, 'B03 /tournaments/1/leaderboard');
    expect(result.textLength).toBeGreaterThan(20);
  });

  test('B04 results page returns HTTP 200 and renders visible text', async ({ page }) => {
    const result = await probe(page, '/tournaments/1/results');
    expectRendered(result, 'B04 /tournaments/1/results');
    expect(result.textLength).toBeGreaterThan(20);
  });

  test('B05 registration page returns HTTP 200 and renders visible text', async ({ page }) => {
    const result = await probe(page, '/tournaments/1/register');
    expectRendered(result, 'B05 /tournaments/1/register');
    expect(result.textLength).toBeGreaterThan(20);
  });

  test('B06 check-in page returns HTTP 200 and renders visible text', async ({ page }) => {
    const result = await probe(page, '/tournaments/1/check-in');
    expectRendered(result, 'B06 /tournaments/1/check-in');
    expect(result.textLength).toBeGreaterThan(20);
  });

  test('B07 arena room page returns HTTP 200 and renders visible text', async ({ page }) => {
    const result = await probe(page, '/arena/1');
    expectRendered(result, 'B07 /arena/1');
    expect(result.textLength).toBeGreaterThan(20);
  });

  test('B08 referee console page returns HTTP 200 and renders visible text', async ({ page }) => {
    const result = await probe(page, '/referee/1');
    expectRendered(result, 'B08 /referee/1');
    expect(result.textLength).toBeGreaterThan(20);
  });

  test('B09 bracket page for an unknown tournament id does not crash or leak a stack trace', async ({
    page,
  }) => {
    const result = await probe(page, '/tournaments/999999/bracket');
    expectRendered(result, 'B09 /tournaments/999999/bracket');
    expect(result.finalUrl, 'B09 must stay on the requested route').toBe(
      '/tournaments/999999/bracket',
    );

    const stackTraceMarkers = [
      'at Object.',
      'at Module.',
      'node_modules',
      '.tsx:',
      'webpack://',
      'Application error',
    ];
    for (const marker of stackTraceMarkers) {
      expect(
        result.visibleText,
        `B09 leaked "${marker}" into the UI: ${result.visibleText.slice(0, 160)}`,
      ).not.toContain(marker);
    }
  });

  test('B10 bracket page exposes navigation links to leaderboard and results', async ({ page }) => {
    const result = await probe(page, '/tournaments/1/bracket');
    expectRendered(result, 'B10 /tournaments/1/bracket nav');

    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') || ''),
    );

    expect(
      hrefs.some((href) => href.includes('/leaderboard')),
      `B10 no leaderboard link found among: ${hrefs.join(', ')}`,
    ).toBe(true);
    expect(
      hrefs.some((href) => href.includes('/results')),
      `B10 no results link found among: ${hrefs.join(', ')}`,
    ).toBe(true);
  });
});
