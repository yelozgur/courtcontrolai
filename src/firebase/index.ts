
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Initializes Firebase services for project: courtcontrolai-2294b.
 * 
 * TRIGGER: Stability and Visibility Update.
 * Logic: Ensure simplified rules allow dashboard visibility.
 * Deployment Nonce: 2024-06-19T16:20:00Z (Visibility Restore)
 */
export function initializeFirebase(): {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const firestore = getFirestore(app);
  const auth = getAuth(app);

  return { app, firestore, auth };
}

export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './use-memo-firebase';
