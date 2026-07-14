import 'react-native-gesture-handler/jestSetup'

import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock'

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage)

jest.mock('firebase/auth', () => {
  return {
    getReactNativePersistence: jest.fn(),
    initializeAuth: jest.fn(),
    getAuth: jest.fn(),
  }
})

jest.mock('firebase/app', () => {
  return {
    initializeApp: jest.fn(),
  }
})

jest.mock('./utils/firebase', () => ({
  db: {},
}))

jest.mock('firebase/firestore', () => {
  return {
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    collection: jest.fn(),
    Timestamp: {
      now: jest.fn(() => ({
        toDate: () => new Date(),
      })),
    },
  }
})

jest.mock('./modules/workout-activity', () => ({
  startActivity: jest.fn(),
  updateActivity: jest.fn(),
  stopActivity: jest.fn(),
}))

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid'),
}))

jest.mock('@react-native-google-signin/google-signin', () => {
  const React = require('react')
  const { TouchableOpacity } = require('react-native')
  const mockButton = (props) => {
    return (
      <TouchableOpacity
        {...props}
        testID={props.testID || 'google-signin-btn'}
      />
    )
  }
  mockButton.Size = { Wide: 'Wide', Standard: 'Standard', Icon: 'Icon' }
  mockButton.Color = { Dark: 'Dark', Light: 'Light', Auto: 'Auto' }
  return {
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: jest.fn().mockResolvedValue(true),
      signIn: jest.fn(),
      signOut: jest.fn(),
      signInSilently: jest.fn(),
      isSignedIn: jest.fn(),
    },
    GoogleSigninButton: mockButton,
  }
})

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationHandler: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  AndroidNotificationPriority: { HIGH: 'high' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))
