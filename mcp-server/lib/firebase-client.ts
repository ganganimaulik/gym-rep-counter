import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
}

let app: FirebaseApp
let db: Firestore

/**
 * Get the shared Firebase client app and Firestore instance.
 * Unlike the previous firebase-admin setup, this uses the standard
 * client SDK — the same approach the mobile app uses.
 */
export function getFirebaseClient(): { app: FirebaseApp; db: Firestore } {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  }
  if (!db) {
    db = getFirestore(app, 'default')
  }
  return { app, db }
}

/**
 * Authenticate a user via their Google OAuth access token.
 *
 * Uses signInWithCredential with a GoogleAuthProvider credential,
 * replacing the previous admin SDK getUserByEmail() approach.
 * This also authenticates the Firestore instance so security rules
 * (request.auth.uid == userId) are enforced server-side.
 */
export async function authenticateUser(accessToken: string): Promise<{
  uid: string
  email: string
  displayName: string | null
}> {
  const { app: firebaseApp } = getFirebaseClient()
  const auth: Auth = getAuth(firebaseApp)
  const credential = GoogleAuthProvider.credential(null, accessToken)
  const result = await signInWithCredential(auth, credential)

  return {
    uid: result.user.uid,
    email: result.user.email || '',
    displayName: result.user.displayName,
  }
}
