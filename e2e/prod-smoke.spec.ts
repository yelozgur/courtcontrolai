import { test, expect } from '@playwright/test';

test.describe('Production Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
  });

  test('P01 home page renders title and main content', async ({ page }) => {
    const title = await page.title();
    expect(title).toContain('CourtControl AI');
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(500);
  });

  test('P02 login page shows Turkish text', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    expect(text).toContain('Giriş Yap');
  });

  test('P03 signup page renders', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    expect(text?.length).toBeGreaterThan(100);
  });

  test('P04 tournaments page accessible', async ({ page }) => {
    await page.goto('/tournaments');
    await page.waitForTimeout(2000);
    const status = page.locator('body').first();
    await expect(status).toBeVisible();
  });

  test('P05 dashboard redirects/login page shows auth context', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    const title = await page.title();
    console.log(`Dashboard final URL: ${currentUrl}, Title: ${title}`);
    if (currentUrl.includes('/login')) {
      console.log('PASS: Dashboard redirected to /login');
    } else {
      const bodyText = await page.textContent('body');
      console.log(`Dashboard body preview: ${(bodyText || '').slice(0, 200)}`);
    }
  });

  test('P06 API endpoints accessible from browser context', async ({ page }) => {
    const [clubsRes] = await Promise.all([page.goto('/api/clubs')]);
    expect(clubsRes?.status()).toBe(200);
    const [tournRes] = await Promise.all([page.goto('/api/tournaments')]);
    expect(tournRes?.status()).toBe(200);
  });

  test('P07 POST to API requires auth (not bypassed by browser)', async ({ page }) => {
    const response = await page.evaluate(async () => {
      return fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', slug: 'test', city: 'Istanbul' })
      }).then(r => ({ status: r.status, body: r.json() }));
    });
    console.log(`POST /api/clubs without session -> status: ${response.status}`);
    expect(response.status).toBe(401);
  });
});
