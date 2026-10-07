/**
 * Quick screenshot script for SEL-63 venue pages.
 * Run with: npx playwright test e2e/venue-screenshots.spec.ts
 */
import { test } from './helpers';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:9002';
const TEST_TOKEN = '41f720237a3dfa6c77360246f619ca69880098f9d9538caf141c470bba06a28b';

test.describe('SEL-63 Venue screenshots', () => {
  test('Take screenshots of venue pages', async ({ page }) => {
    test.setTimeout(60000);

    // Authenticate using test-session provider
    const response = await page.request.post(`${BASE_URL}/api/auth/callback/test-session`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `token=${TEST_TOKEN}&json=true`,
    });

    console.log('Auth response status:', response.status());

    // Navigate to venues page
    await page.goto(`${BASE_URL}/dashboard/venues`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'docs/screenshots/venues-list-2026-10-07.png', fullPage: true });

    // Try to navigate to a venue detail page (will show 404 if no venues exist)
    await page.goto(`${BASE_URL}/dashboard/venues/nonexistent`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'docs/screenshots/venues-detail-2026-10-07.png', fullPage: true });
  });
});
