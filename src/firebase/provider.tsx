'use client';

import React, { createContext, useContext } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';

interface FirebaseContextValue {
  // Nullable throughout: the provider is mounted before Firebase resolves, so
  // consumers must handle "not ready yet" explicitly rather than crashing.
  app: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({
  children,
  app,
  firestore,
  auth,
}: {
  children: React.ReactNode;
  /**
   * Nullable on purpose. FirebaseClientProvider renders this component from
   * the very first paint, before `initializeFirebase()` has resolved. Accepting
   * null keeps the React tree shape constant; the alternative — rendering
   * children without the provider until Firebase is ready — changes the root
   * element type and remounts the entire app on every load.
   */
  app: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}) {
  // A fresh object literal on every render invalidates the context and
  // re-renders all ~33 useFirestore() consumers for no reason. The three
  // values are stable references owned by the Firebase SDK, so the memo key
  // never changes in practice.
  const value = React.useMemo(() => ({ app, firestore, auth }), [app, firestore, auth]);

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

/**
 * CourtControl AI: Offline fallback. Onceki implementasyon context yoksa
 * throw ediyordu ve sayfa tamamen crash oluyordu. Simdi null donduruyor —
 * hooks bunu "Firebase unavailable, logged out" olarak yorumluyor ve UI
 * normal sekilde render ediyor. Gercek login denemesi basarisiz olur ama
 * sayfa erisilebilir kalir.
 */
export function useFirebase(): FirebaseContextValue | null {
  return useContext(FirebaseContext);
}

export function useFirebaseApp(): FirebaseApp | null {
  return useFirebase()?.app ?? null;
}

export function useFirestore(): Firestore | null {
  return useFirebase()?.firestore ?? null;
}

export function useAuth(): Auth | null {
  return useFirebase()?.auth ?? null;
}
