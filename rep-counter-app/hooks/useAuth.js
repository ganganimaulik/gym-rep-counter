import { useState, useEffect } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '../utils/firebase';

export const useAuth = (onAuthSuccess) => {
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
      if (firebaseUser) {
        await onAuthSuccess(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
        await onAuthSuccess(null);
      }
    });

    return subscriber;
  }, []);

  const onGoogleButtonPress = async () => {
    setIsSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { idToken } = await GoogleSignin.signIn();

      if (!idToken) {
        setIsSigningIn(false);
        return;
      }
      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleCredential);
    } catch (error) {
      if (error.code === '12501' || error.code === '-5') {
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
      console.error(error);
    }
  };

  return { user, initializing, isSigningIn, onGoogleButtonPress, disconnectAccount };
};