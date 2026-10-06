import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App;
let adminAuth: Auth;

export function getFirebaseAdmin(): Auth {
  if (adminAuth) return adminAuth;

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

  adminAuth = getAuth(adminApp);
  return adminAuth;
}
