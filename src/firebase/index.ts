
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Initializes Firebase services for project: courtcontrolai-2294b.
 * 
 * TRIGGER: Security Rules Deployment for Public Listing.
 * Explicitly granting 'list' and 'get' to all visitors for Clubs, Tournaments, and Matches.
 * This is critical for the Dashboard to load organizations and live feeds.
 * Granting 'get', 'create', 'update' to User owners for their own /users/{userId} documents.
 * 
 * Deployment Nonce: 2024-06-17T11:45:00Z (Triggering rule refresh to resolve UI permission error)
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
