
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Initializes Firebase services for project: Court Control AI.
 *
 * CourtControl AI: Lokal gelistirme icin Firebase emulator destegi.
 * NEXT_PUBLIC_USE_EMULATOR=true iken Firestore + Auth emulator'a baglanir.
 * Prod'da bu env set edilmedigi icin gercek Firebase backend'e gider.
 *
 * VERSION: 2.1 (Local Emulator Support)
 * Deployment Nonce: 2026-07-12T17:51:00Z
 */
export function initializeFirebase(): {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const firestore = getFirestore(app);
  const auth = getAuth(app);

  // Local emulator connection (browser-side, bir kez)
  const useEmulator =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_USE_EMULATOR === 'true';

  if (useEmulator) {
    // @ts-expect-error - __CCA_EMULATOR_CONNECTED global flag SSR'da paylasilmiyor,
    // browser'da ikinci kez connect etmeyi onler.
    if (!(window as any).__CCA_EMULATOR_CONNECTED) {
      try {
        connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
        connectAuthEmulator(auth, '127.0.0.1', 9099, { disableWarnings: true });
        (window as any).__CCA_EMULATOR_CONNECTED = true;
        // eslint-disable-next-line no-console
        console.info('[firebase] Connected to LOCAL emulators (Firestore 8080, Auth 9099)');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[firebase] Emulator connection failed:', e);
      }
    }
  }

  return { app, firestore, auth };
}

export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './use-memo-firebase';
