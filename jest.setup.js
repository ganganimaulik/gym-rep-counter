import 'react-native-gesture-handler/jestSetup';

import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('firebase/auth', () => {
  return {
    getReactNativePersistence: jest.fn(),
    initializeAuth: jest.fn(),
  };
});

jest.mock('firebase/app', () => {
  return {
    initializeApp: jest.fn(),
  };
});

jest.mock('./utils/firebase', () => ({
  db: {},
}));

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
  };
});