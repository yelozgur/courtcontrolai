import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
  } else {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'courtcontrolai-2294b';
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin SDK credentials missing. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY environment variables.'
      );
    }

    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  return adminApp;
}

export function getFirebaseAdmin(): Auth {
  if (adminAuth) return adminAuth;
  const app = getAdminApp();
  adminAuth = getAuth(app);
  return adminAuth;
}

export function getAdminFirestore(): Firestore {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  adminDb = getFirestore(app);
  return adminDb;
}
