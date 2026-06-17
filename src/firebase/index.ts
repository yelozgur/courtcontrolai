
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Initializes Firebase services for project: courtcontrolai-2294b.
 * 
 * TRIGGER: Role-Based Stage Logic Deployment.
 * Logic: Standard READ enabled. Write restricted by clubId or userId.
 * Stage Management: Locks categories/format if status != 'draft'.
 * Deployment Nonce: 2024-06-19T10:30:00Z (Architectural Stage Update)
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
