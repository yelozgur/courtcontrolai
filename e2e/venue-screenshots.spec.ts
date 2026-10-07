import { test, expect } from './helpers';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:9002';
const TEST_TOKEN = '41f720237a3dfa6c77360246f619ca69880098f9d9538caf141c470bba06a28b';

async function authenticate(page: import('@playwright/test').Page) {
  const csrfResp = await page.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfResp.json();
  console.log('CSRF token obtained:', csrfToken?.slice(0, 16) + '...');

  const resp = await page.request.post(`${BASE_URL}/api/auth/callback/test-session`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `token=${TEST_TOKEN}&csrfToken=${csrfToken}&json=true`,
    maxRedirects: 0,
  });
  console.log('Auth callback status:', resp.status());

  const sessionResp = await page.request.get(`${BASE_URL}/api/auth/session`);
  const sessionBody = await sessionResp.text();
  console.log('Session:', sessionBody.slice(0, 200));
  return sessionBody.includes('test-user-e2e') || sessionBody.includes('test@courtcontrolai');
}

test.describe('SEL-68 Venue screenshots', () => {
  test('Capture venue list, detail (openHours), and court reorder', async ({ page }) => {
    test.setTimeout(90000);

    const authed = await authenticate(page);
    expect(authed, 'session must contain test user').toBe(true);

    await page.waitForTimeout(1000);

    await page.goto(`${BASE_URL}/dashboard/venues`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const apiResp = await page.request.get(`${BASE_URL}/api/venues`);
    const apiText = await apiResp.text();
    console.log(`API /api/venues: status=${apiResp.status()} body=${apiText.slice(0, 300)}`);

    let currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('Redirected to /login, waiting for bridge attempt...');
      await page.waitForTimeout(2000);
      await page.goto(`${BASE_URL}/dashboard/venues`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      currentUrl = page.url();
    }

    const listUrl = currentUrl;
    const listText = await page.evaluate(() => document.body?.innerText ?? '');
    console.log(`Venue list: url=${listUrl} textLen=${listText.length}`);
    console.log('Venue list text (first 300):', listText.slice(0, 300));
    expect(listUrl, 'must not redirect to /login').not.toContain('/login');
    expect(listText, 'must show seeded venue "Main Arena"').toContain('Main Arena');
    await page.screenshot({ path: 'docs/screenshots/venues-list-2026-10-08.png', fullPage: true });

    await page.goto(`${BASE_URL}/dashboard/venues/seed-visual-venue`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const detailUrl = page.url();
    const detailText = await page.evaluate(() => document.body?.innerText ?? '');
    console.log(`Venue detail: url=${detailUrl} textLen=${detailText.length}`);
    console.log('Venue detail text (first 500):', detailText.slice(0, 500));
    expect(detailUrl, 'must not redirect to /login').not.toContain('/login');

    const hoursTab = page.getByRole('tab').or(page.locator('button')).filter({ hasText: /open hours|açılış saatleri/i });
    if (await hoursTab.count() > 0) {
      await hoursTab.first().click();
      await page.waitForTimeout(1500);
      const hoursText = await page.evaluate(() => document.body?.innerText ?? '');
      console.log('Hours tab text (first 500):', hoursText.slice(0, 500));
      expect(hoursText, 'openHours tab must show weekday labels').toMatch(/Monday|Pazartesi/);
      await page.screenshot({ path: 'docs/screenshots/venues-detail-2026-10-08.png', fullPage: true });
    } else {
      console.log('No hours tab found, taking screenshot of default tab');
      await page.screenshot({ path: 'docs/screenshots/venues-detail-2026-10-08.png', fullPage: true });
    }

    const courtsTab = page.getByRole('tab').or(page.locator('button')).filter({ hasText: /court|saha/i }).first();
    if (await courtsTab.count() > 0) {
      await courtsTab.click();
      await page.waitForTimeout(1000);
    }

    const courtsBefore = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      return Array.from(inputs).map((i) => (i as HTMLInputElement).value).join(', ');
    });
    console.log('Courts before reorder:', courtsBefore);

    const moveButtons = page.locator('button').filter({ has: page.locator('svg.lucide-grip-vertical, svg[class*="rotate-90"]') });
    const moveCount = await moveButtons.count();
    console.log('Move buttons found:', moveCount);
    if (moveCount >= 2) {
      const secondMoveButton = moveButtons.nth(1);
      if (await secondMoveButton.isDisabled() === false) {
        await secondMoveButton.click();
        await page.waitForTimeout(500);
      }
    }

    const courtsAfter = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      return Array.from(inputs).map((i) => (i as HTMLInputElement).value).join(', ');
    });
    console.log('Courts after reorder:', courtsAfter);

    await page.screenshot({ path: 'docs/screenshots/venues-reorder-2026-10-08.png', fullPage: true });
  });
});
