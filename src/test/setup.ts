/**
 * Vitest global setup
 *
 * Loaded before each test file. Provides:
 * - jest-dom matchers (toBeInTheDocument, etc.)
 * - Firebase v11 polyfills (structuredClone) where missing
 *
 * Node 18+ already ships TextEncoder/TextDecoder as globals, so we don't
 * need to polyfill them.
 */

import '@testing-library/jest-dom/vitest';

// Firebase v11 uses structuredClone on global in some flows
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
}

// Quiet noisy console.error from React in tests (e.g. act() warnings).
// Override per-test when needed: vi.spyOn(console, 'error').mockImplementation(...)
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  if (msg.includes('not wrapped in act(')) return;
  originalError(...(args as Parameters<typeof originalError>));
};
