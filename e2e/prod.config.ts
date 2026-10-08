import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '/Users/ozguryel/Personal Projects/CourtControlAI/courtcontrolai-firebase/e2e',
  testMatch: '**/prod-smoke.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: 'https://courtcontrolai-firebase.vercel.app',
    headless: true,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: {} }],
});
