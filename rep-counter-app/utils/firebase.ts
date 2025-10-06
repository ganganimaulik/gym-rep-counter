import { initializeApp, FirebaseApp } from 'firebase/app'
import { Auth } from 'firebase/auth'
import {
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth/react-native'
import { getFirestore, Firestore } from 'firebase/firestore'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'

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
const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
})
const db: Firestore = getFirestore(app, 'default')

export { auth, db }
