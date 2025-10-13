import { renderHook, act } from '@testing-library/react-native'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { onAuthStateChanged, signInWithCredential } from 'firebase/auth'
import { useAuth } from '../useAuth'
import { auth } from '../../utils/firebase'

// Mock dependencies
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}))

jest.mock('firebase/auth', () => ({
  getReactNativePersistence: jest.fn(),
  initializeAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
  signInWithCredential: jest.fn(),
}))

// Mock the auth object from firebase to control signOut behavior
jest.mock('../../utils/firebase', () => ({
  auth: {
    signOut: jest.fn(),
  },
}))

const mockUser = { uid: 'test-uid' }
const mockIdToken = 'mock-id-token'

describe('useAuth Hook', () => {
  let onAuthStateChangedCallback: (user: any) => void
  const mockOnAuthSuccess = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
      onAuthStateChangedCallback = callback
      return jest.fn() // Return an unsubscribe function
    })
    // Reset mocks to default successful behavior before each test
    ;(GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined)
    ;(auth.signOut as jest.Mock).mockResolvedValue(undefined)
  })

  it('should initialize and set user to null when no user is logged in', async () => {
    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    expect(result.current.initializing).toBe(true)

    await act(async () => {
      onAuthStateChangedCallback(null)
    })

    expect(result.current.initializing).toBe(false)
    expect(result.current.user).toBeNull()
    expect(mockOnAuthSuccess).toHaveBeenCalledWith(null)
  })

  it('should initialize and set user when a user is logged in', async () => {
    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      onAuthStateChangedCallback(mockUser)
    })

    expect(result.current.initializing).toBe(false)
    expect(result.current.user).toEqual(mockUser)
    expect(mockOnAuthSuccess).toHaveBeenCalledWith(mockUser)
  })

  it('should handle Google Sign-In successfully', async () => {
    ;(GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      data: { idToken: mockIdToken },
    })
    ;(signInWithCredential as jest.Mock).mockResolvedValue({ user: mockUser })

    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.onGoogleButtonPress()
    })

    expect(result.current.isSigningIn).toBe(false)
    expect(signInWithCredential).toHaveBeenCalled()
  })

  it('should handle Google Sign-In cancellation', async () => {
    const error = { code: 'SIGN_IN_CANCELLED' }
    ;(GoogleSignin.signIn as jest.Mock).mockRejectedValue(error)
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.onGoogleButtonPress()
    })

    expect(result.current.isSigningIn).toBe(false)
    expect(signInWithCredential).not.toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'User cancelled the Google Sign-In flow.',
    )
    consoleLogSpy.mockRestore()
  })

  it('should handle other Google Sign-In errors', async () => {
    const error = new Error('Some other error')
    ;(GoogleSignin.signIn as jest.Mock).mockRejectedValue(error)
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.onGoogleButtonPress()
    })

    expect(result.current.isSigningIn).toBe(false)
    expect(signInWithCredential).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Google Sign-In error:', error)
    consoleErrorSpy.mockRestore()
  })

  it('should handle account disconnection successfully', async () => {
    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.disconnectAccount()
    })

    expect(GoogleSignin.signOut).toHaveBeenCalled()
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('should handle errors during Google Sign-Out', async () => {
    const error = new Error('Google SignOut error')
    ;(GoogleSignin.signOut as jest.Mock).mockRejectedValue(error)
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.disconnectAccount()
    })

    expect(auth.signOut).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error disconnecting account:',
      error,
    )
    consoleErrorSpy.mockRestore()
  })

  it('should handle errors during Firebase Sign-Out', async () => {
    const error = new Error('Firebase SignOut error')
    ;(auth.signOut as jest.Mock).mockRejectedValue(error)
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.disconnectAccount()
    })

    expect(GoogleSignin.signOut).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error disconnecting account:',
      error,
    )
    consoleErrorSpy.mockRestore()
  })

  it('should throw an error if Google Sign-In returns no ID token', async () => {
    ;(GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      data: { idToken: null },
    })
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.onGoogleButtonPress()
    })

    expect(result.current.isSigningIn).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Google Sign-In error:',
      new Error('Google Sign-In failed: No ID token received.'),
    )
    consoleErrorSpy.mockRestore()
  })
})