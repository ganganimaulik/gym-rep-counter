import { useState, useEffect } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '../utils/firebase';

export const useAuth = (onAuthStateChangeCallback) => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
    });

    const subscriber = onAuthStateChanged(auth, async (firebaseUser) => {
      if (initializing) {
        setInitializing(false);
      }
      setUser(firebaseUser);
      if (onAuthStateChangeCallback) {
        await onAuthStateChangeCallback(firebaseUser);
      }
    });

    return subscriber;
  }, [onAuthStateChangeCallback]);

  const onGoogleButtonPress = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { idToken } = await GoogleSignin.signIn();
      if (!idToken) {
        setIsSigningIn(false);
        return; // User cancelled
      }
      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleCredential);
    } catch (error) {
      if (error.code === '12501' || error.code === '-5' || error.code === 'SIGN_IN_CANCELLED') {
        console.log('User cancelled the Google Sign-In flow.');
      } else {
        console.error('Google Sign-In error:', error);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const disconnectAccount = async () => {
    try {
      await GoogleSignin.signOut();
      await auth.signOut();
    } catch (error) {
      console.error('Error disconnecting account:', error);
    }
  };

  return { user, initializing, isSigningIn, onGoogleButtonPress, disconnectAccount };
};