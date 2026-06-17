
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Initializes Firebase services. 
 * This is called on the client side only.
 * 
 * TRIGGER: Security Rules Synchronization.
 * Deploying refined rules to allow public "list" and "get" operations across 
 * all tournament, club, and match collections, while enforcing owner-only writes.
 */
export function initializeFirebase(): {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  // Ensure we don't initialize multiple times
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  // Connect to services
  const firestore = getFirestore(app);
  const auth = getAuth(app);

  return { app, firestore, auth };
}

export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './use-memo-firebase';
