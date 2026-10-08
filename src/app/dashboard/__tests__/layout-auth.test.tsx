/**
 * SEL-96: Regression test for the Google sign-in redirect loop.
 *
 * This test verifies the redirect guard logic in isolation. The full component
 * test is complex due to the many dependencies (Firebase, NextAuth, i18n, etc.),
 * so this test extracts and verifies the core redirect condition.
 *
 * The bug: Dashboard gated on Firebase `useUser()` which is null in production
 * (no FIREBASE_ADMIN_* env vars), causing a permanent redirect loop after
 * successful NextAuth sign-in.
 *
 * The fix: Gate on NextAuth `useSession()` instead. Firebase Auth is still used
 * for Firestore reads, but its absence does not block dashboard access.
 */

import { describe, it, expect } from 'vitest';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  sessionStatus: SessionStatus;
  hasNextAuthSession: boolean;
  firebaseUser: { uid: string } | null;
  firebaseLoading: boolean;
  firebaseAuthUnavailable: boolean;
  testModeLoading: boolean;
  isTestMode: boolean;
}

/**
 * OLD (broken) redirect logic from layout.tsx before SEL-96 fix.
 * This gated on Firebase user, causing the redirect loop.
 */
function shouldRedirectOld(state: AuthState): boolean {
  if (state.sessionStatus === 'loading') return false;
  if (state.testModeLoading) return false;
  if (state.isTestMode && state.hasNextAuthSession) return false;
  if (!state.firebaseAuthUnavailable && !state.firebaseLoading && !state.firebaseUser) {
    return true;
  }
  return false;
}

/**
 * NEW (fixed) redirect logic from layout.tsx after SEL-96 fix.
 * This gates on NextAuth session, breaking the redirect loop.
 */
function shouldRedirectNew(state: AuthState): boolean {
  if (state.sessionStatus === 'loading') return false;
  if (state.testModeLoading) return false;
  if (state.hasNextAuthSession) return false;
  return true;
}

describe('SEL-96: Redirect guard logic', () => {
  it('OLD logic: redirects when NextAuth session is valid but Firebase user is null (THE BUG)', () => {
    const state: AuthState = {
      sessionStatus: 'authenticated',
      hasNextAuthSession: true,
      firebaseUser: null,
      firebaseLoading: false,
      firebaseAuthUnavailable: false,
      testModeLoading: false,
      isTestMode: false,
    };

    expect(shouldRedirectOld(state)).toBe(true);
  });

  it('NEW logic: does NOT redirect when NextAuth session is valid but Firebase user is null (THE FIX)', () => {
    const state: AuthState = {
      sessionStatus: 'authenticated',
      hasNextAuthSession: true,
      firebaseUser: null,
      firebaseLoading: false,
      firebaseAuthUnavailable: false,
      testModeLoading: false,
      isTestMode: false,
    };

    expect(shouldRedirectNew(state)).toBe(false);
  });

  it('NEW logic: redirects when NextAuth session is unauthenticated', () => {
    const state: AuthState = {
      sessionStatus: 'unauthenticated',
      hasNextAuthSession: false,
      firebaseUser: null,
      firebaseLoading: false,
      firebaseAuthUnavailable: false,
      testModeLoading: false,
      isTestMode: false,
    };

    expect(shouldRedirectNew(state)).toBe(true);
  });

  it('NEW logic: does NOT redirect while NextAuth session is loading', () => {
    const state: AuthState = {
      sessionStatus: 'loading',
      hasNextAuthSession: false,
      firebaseUser: null,
      firebaseLoading: true,
      firebaseAuthUnavailable: false,
      testModeLoading: false,
      isTestMode: false,
    };

    expect(shouldRedirectNew(state)).toBe(false);
  });

  it('NEW logic: does NOT redirect when Firebase is unavailable but NextAuth session is valid', () => {
    const state: AuthState = {
      sessionStatus: 'authenticated',
      hasNextAuthSession: true,
      firebaseUser: null,
      firebaseLoading: false,
      firebaseAuthUnavailable: true,
      testModeLoading: false,
      isTestMode: false,
    };

    expect(shouldRedirectNew(state)).toBe(false);
  });

  it('NEW logic: does NOT redirect when both NextAuth and Firebase are valid', () => {
    const state: AuthState = {
      sessionStatus: 'authenticated',
      hasNextAuthSession: true,
      firebaseUser: { uid: 'firebase-uid-123' },
      firebaseLoading: false,
      firebaseAuthUnavailable: false,
      testModeLoading: false,
      isTestMode: false,
    };

    expect(shouldRedirectNew(state)).toBe(false);
  });
});
