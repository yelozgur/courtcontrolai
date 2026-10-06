'use client';

import React, { useState, useEffect } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

/**
 * CourtControl AI: Offline-tolerant Firebase provider.
 *
 * Onceki implementasyon Firebase init basarisiz olursa tum sayfayi loading
 * shell ile kilitliyordu. Yeni davranis:
 *
 *  1. useEffect'te initializeFirebase() cagir
 *  2. Basariliysa → FirebaseProvider ile children render et
 *  3. Basarisiz olursa → children'i FirebaseProvider OLMADAN render et
 *     (hooks null dondurur, sayfa "logged out" gibi davranir)
 *
 * Boylece Firebase backend'i erisilemez olsa bile UI calisir, sadece gercek
 * login denemesi basarisiz olur. Hata console'a yazilir ama UI bloklanmaz.
 */
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [firebase, setFirebase] = useState<ReturnType<typeof initializeFirebase> | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    try {
      const fb = initializeFirebase();
      if (cancelled) return;
      setFirebase(fb);
      setInitError(null);
    } catch (e) {
      if (cancelled) return;
      // The previous implementation left no trace in the UI and no way to
      // retry: a failed init looked exactly like a normal logged-out session,
      // forever. Keep the error so it can be surfaced and retried.
      setInitError(e instanceof Error ? e : new Error('Firebase initialisation failed'));
      console.warn('[firebase] init failed (offline fallback):', e);
    }
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Always render the same tree shape. Returning a Fragment before Firebase is
  // ready and a Provider afterwards changes the root element type, which makes
  // React discard and rebuild the whole subtree on first load — remounting
  // every page, double-running every useEffect/onSubscription, and guaranteeing
  // a first paint with a null database. Passing null through the provider keeps
  // the tree stable and lets the hooks return their null-safe values.
  return (
    <FirebaseProvider
      app={firebase?.app ?? null}
      firestore={firebase?.firestore ?? null}
      auth={firebase?.auth ?? null}
    >
      <FirebaseErrorListener />
      {initError && <FirebaseInitError error={initError} onRetry={() => setAttempt((n) => n + 1)} />}
      {children}
    </FirebaseProvider>
  );
}

/** Non-blocking banner: the app stays usable, the outage stays visible. */
function FirebaseInitError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      <span>
        Sunucuya bağlanılamıyor — oturum bilgileri yüklenemiyor. Giriş yapılamıyor.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold underline underline-offset-2"
      >
        Tekrar dene
      </button>
    </div>
  );
}
