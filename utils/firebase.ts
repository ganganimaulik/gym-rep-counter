import { initializeApp, FirebaseApp } from 'firebase/app'
import {
  initializeAuth,
  Auth,
  getAuth,
  connectAuthEmulator,
} from 'firebase/auth'
// @ts-expect-error - Valid import but types might be missing in some node_modules resolution
import { getReactNativePersistence } from 'firebase/auth'
import {
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
} from 'firebase/firestore'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_MEASUREMENT_ID,
}

const app: FirebaseApp = initializeApp(firebaseConfig)

let auth: Auth
if (Platform.OS === 'web') {
  auth = getAuth(app)
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  })
}

const db: Firestore = getFirestore(app, 'default')

if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

export { auth, db }
