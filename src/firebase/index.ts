
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Initializes Firebase services for project: courtcontrolai-2294b.
 * 
 * TRIGGER: Security Rules Deployment matching user-provided logic.
 * Logic: Users (Owner read/write), Clubs/Tournaments/Matches (Publicly listable/readable).
 * 
 * Deployment Nonce: 2024-06-17T12:05:00Z (Triggering final rule synchronization)
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
