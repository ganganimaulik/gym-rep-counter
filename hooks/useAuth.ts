import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User as FirebaseUser,
  signInWithPopup,
} from 'firebase/auth'
import { Platform } from 'react-native'
import { auth } from '../utils/firebase' // Assuming firebase is configured and exported from this path

// Interfaces
export interface AuthHook {
  user: FirebaseUser | null
  initializing: boolean
  isSigningIn: boolean
  onGoogleButtonPress: () => Promise<void>
  disconnectAccount: () => Promise<void>
}

type OnAuthSuccessCallback = (user: FirebaseUser | null) => Promise<void>

export const useAuth = (
  onAuthSuccess: OnAuthSuccessCallback,
  onSignOut?: () => Promise<void>,
): AuthHook => {
  const [user, setUser] = useState<FirebaseUser | null>(null)

  const [initializing, setInitializing] = useState<boolean>(true)
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false)

  // Use refs to avoid re-subscribing to onAuthStateChanged
  const initializingRef = useRef(true)
  const onAuthSuccessRef = useRef(onAuthSuccess)
  onAuthSuccessRef.current = onAuthSuccess
  const onSignOutRef = useRef(onSignOut)
  onSignOutRef.current = onSignOut

  useEffect(() => {
    if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_PLAYWRIGHT === '1') {
      // Support Playwright mock user via localStorage ONLY in test environment
      const mockUserStr = localStorage.getItem('PLAYWRIGHT_MOCK_USER')
      if (mockUserStr) {
        try {
          const mockUser = JSON.parse(mockUserStr)
          setUser(mockUser)
          onAuthSuccessRef.current(mockUser)
        } catch {}
      }

      const win = window as unknown as {
        setMockUser?: (mockUser: FirebaseUser | null) => void
      }
      win.setMockUser = (mockUser) => {
        setUser(mockUser)
        onAuthSuccessRef.current(mockUser)
      }
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') {
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
      })
    }

    const subscriber = onAuthStateChanged(auth, async (firebaseUser) => {
      if (initializingRef.current) {
        initializingRef.current = false
        setInitializing(false)
      }

      setUser(firebaseUser)
      await onAuthSuccessRef.current(firebaseUser)
    })

    return subscriber // unsubscribe on unmount
  }, [])

  const onGoogleButtonPress = useCallback(async () => {
    setIsSigningIn(true)
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider()
        await signInWithPopup(auth, provider)
      } else {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        })
        const signInResponse = await GoogleSignin.signIn()
        const idToken = signInResponse.data?.idToken

        if (!idToken) {
          throw new Error('Google Sign-In failed: No ID token received.')
        }

        const googleCredential = GoogleAuthProvider.credential(idToken)
        await signInWithCredential(auth, googleCredential)
      }
    } catch (error) {
      // Known error codes for user cancellation
      const gError = error as { code?: string }
      if (gError.code === '12501' || gError.code === 'SIGN_IN_CANCELLED') {
      } else {
        console.error('Google Sign-In error:', error)
      }
    } finally {
      setIsSigningIn(false)
    }
  }, [])

  const disconnectAccount = useCallback(async () => {
    try {
      // Clear this account's cached data before the auth state flips to
      // null, so the guest reload (and any future sign-in) can't read it.
      await onSignOutRef.current?.()
      if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_PLAYWRIGHT === '1') {
        localStorage.removeItem('PLAYWRIGHT_MOCK_USER')
        setUser(null)
        onAuthSuccessRef.current(null)
        return
      }
      if (Platform.OS !== 'web') {
        await GoogleSignin.signOut()
      }
      await auth.signOut()
    } catch (error) {
      console.error('Error disconnecting account:', error)
    }
  }, [])

  return useMemo(
    () => ({
      user,
      initializing,
      isSigningIn,
      onGoogleButtonPress,
      disconnectAccount,
    }),
    [user, initializing, isSigningIn, onGoogleButtonPress, disconnectAccount],
  )
}
