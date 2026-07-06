import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;
let db: Firestore;
let adminAuth: Auth;

export function getFirebaseAdmin() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
    );
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    app = getApps()[0];
  }

  if (!db) {
    db = getFirestore(app, 'default');
  }
  if (!adminAuth) {
    adminAuth = getAuth(app);
  }

  return { app, db, auth: adminAuth };
}
