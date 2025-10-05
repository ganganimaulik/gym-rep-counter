import { useState, useEffect } from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../utils/firebase"; // Assuming firebase is configured and exported from this path

// Interfaces
export interface AuthHook {
  user: FirebaseUser | null;
  initializing: boolean;
  isSigningIn: boolean;
  onGoogleButtonPress: () => Promise<void>;
  disconnectAccount: () => Promise<void>;
}

type OnAuthSuccessCallback = (user: FirebaseUser | null) => Promise<void>;

export const useAuth = (onAuthSuccess: OnAuthSuccessCallback): AuthHook => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

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
      await onAuthSuccess(firebaseUser);
    });

    return subscriber; // unsubscribe on unmount
  }, [initializing, onAuthSuccess]);

  const onGoogleButtonPress = async () => {
    setIsSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const signInResponse = await GoogleSignin.signIn();
      const idToken = signInResponse.data?.idToken;

      if (!idToken) {
        throw new Error("Google Sign-In failed: No ID token received.");
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleCredential);
    } catch (error: any) {
      // Known error codes for user cancellation
      if (error.code === "12501" || error.code === "SIGN_IN_CANCELLED") {
        console.log("User cancelled the Google Sign-In flow.");
      } else {
        console.error("Google Sign-In error:", error);
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
      console.error("Error disconnecting account:", error);
    }
  };

  return {
    user,
    initializing,
    isSigningIn,
    onGoogleButtonPress,
    disconnectAccount,
  };
};
