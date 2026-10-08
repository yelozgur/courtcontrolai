/**
 * Single source of truth for the E2E credentials provider.
 *
 * The provider used to be registered whenever AUTH_TEST_ENABLED was "true",
 * while /api/auth/test-mode reported it as disabled in production. That
 * asymmetry meant a stray env var on Vercel would silently open a credentials
 * sign-in in production even though the status endpoint claimed it was off.
 * Both call sites must use this predicate.
 */

export function isAuthTestEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_TEST_ENABLED === "true";
}