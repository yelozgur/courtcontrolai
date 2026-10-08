import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Playwright owns e2e/**.spec.ts. Without this, vitest picks those files up
    // by default and every `npm test` fails with "Playwright Test did not expect
    // test.describe() to be called here" — a red suite whose tests all pass,
    // which trains everyone to ignore the exit code.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})