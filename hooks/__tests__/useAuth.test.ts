import { renderHook, act } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import {
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth'
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

jest.mock('firebase/auth', () => {
  // Constructable so the web popup flow (`new GoogleAuthProvider()`) works.
  const GoogleAuthProvider: any = jest.fn()
  GoogleAuthProvider.credential = jest.fn()
  return {
    getReactNativePersistence: jest.fn(),
    initializeAuth: jest.fn(),
    getAuth: jest.fn(),
    onAuthStateChanged: jest.fn(),
    GoogleAuthProvider,
    signInWithCredential: jest.fn(),
    signInWithPopup: jest.fn(),
  }
})

// Mock the auth object from firebase to control signOut behavior
jest.mock('../../utils/firebase', () => ({
  auth: {
    signOut: jest.fn(),
  },
}))

const mockUser = { uid: 'test-uid' }
const mockIdToken = 'mock-id-token'

describe('useAuth Hook', () => {
  let onAuthStateChangedCallback: (user: unknown) => void
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
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {})

    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.onGoogleButtonPress()
    })

    expect(result.current.isSigningIn).toBe(false)
    expect(signInWithCredential).not.toHaveBeenCalled()
    expect(consoleLogSpy).not.toHaveBeenCalled()
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

  it('should run the onSignOut cleanup before signing out', async () => {
    const callOrder: string[] = []
    const mockOnSignOut = jest.fn(async () => {
      callOrder.push('cleanup')
    })
    ;(auth.signOut as jest.Mock).mockImplementation(async () => {
      callOrder.push('signOut')
    })

    const { result } = renderHook(() =>
      useAuth(mockOnAuthSuccess, mockOnSignOut),
    )

    await act(async () => {
      await result.current.disconnectAccount()
    })

    expect(mockOnSignOut).toHaveBeenCalled()
    expect(callOrder).toEqual(['cleanup', 'signOut'])
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

  it('treats the native 12501 code as a user cancellation', async () => {
    ;(GoogleSignin.signIn as jest.Mock).mockRejectedValue({ code: '12501' })
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

    await act(async () => {
      await result.current.onGoogleButtonPress()
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(result.current.isSigningIn).toBe(false)
    consoleErrorSpy.mockRestore()
  })

  it('configures native Google Sign-In with the bundled client IDs', () => {
    process.env.EXPO_PUBLIC_WEB_CLIENT_ID = 'web-client'
    process.env.EXPO_PUBLIC_IOS_CLIENT_ID = 'ios-client'

    renderHook(() => useAuth(mockOnAuthSuccess))

    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: 'web-client',
      iosClientId: 'ios-client',
    })
  })

  it('unsubscribes from auth state changes on unmount', () => {
    const unsubscribe = jest.fn()
    ;(onAuthStateChanged as jest.Mock).mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useAuth(mockOnAuthSuccess))
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  describe('on web', () => {
    const originalOS = Platform.OS
    const originalPlaywright = process.env.EXPO_PUBLIC_PLAYWRIGHT
    let store: Record<string, string>

    beforeEach(() => {
      Platform.OS = 'web'
      store = {}
      // The Node test env has no usable localStorage, so stand one in.
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: {
          getItem: jest.fn((k: string) => store[k] ?? null),
          setItem: jest.fn((k: string, v: string) => {
            store[k] = v
          }),
          removeItem: jest.fn((k: string) => {
            delete store[k]
          }),
        },
      })
    })

    afterEach(() => {
      Platform.OS = originalOS
      process.env.EXPO_PUBLIC_PLAYWRIGHT = originalPlaywright
      delete (globalThis as { localStorage?: unknown }).localStorage
      delete (window as unknown as { setMockUser?: unknown }).setMockUser
    })

    it('signs in through a popup instead of the native SDK', async () => {
      ;(signInWithPopup as jest.Mock).mockResolvedValue({ user: mockUser })
      const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

      await act(async () => {
        await result.current.onGoogleButtonPress()
      })

      expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.anything())
      expect(GoogleSignin.signIn).not.toHaveBeenCalled()
      expect(result.current.isSigningIn).toBe(false)
    })

    it('does not configure the native Google Sign-In SDK', () => {
      renderHook(() => useAuth(mockOnAuthSuccess))

      expect(GoogleSignin.configure).not.toHaveBeenCalled()
    })

    it('reports a failed popup sign-in and clears the in-progress flag', async () => {
      const error = new Error('popup blocked')
      ;(signInWithPopup as jest.Mock).mockRejectedValue(error)
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

      await act(async () => {
        await result.current.onGoogleButtonPress()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Google Sign-In error:',
        error,
      )
      expect(result.current.isSigningIn).toBe(false)
      consoleErrorSpy.mockRestore()
    })

    it('signs out without touching the native SDK', async () => {
      delete process.env.EXPO_PUBLIC_PLAYWRIGHT

      const { result } = renderHook(() => useAuth(mockOnAuthSuccess))

      await act(async () => {
        await result.current.disconnectAccount()
      })

      expect(GoogleSignin.signOut).not.toHaveBeenCalled()
      expect(auth.signOut).toHaveBeenCalled()
    })

    describe('under Playwright', () => {
      beforeEach(() => {
        process.env.EXPO_PUBLIC_PLAYWRIGHT = '1'
      })

      it('restores a mock user persisted in localStorage', async () => {
        store.PLAYWRIGHT_MOCK_USER = JSON.stringify({ uid: 'mock-uid' })

        const { result } = renderHook(() => useAuth(mockOnAuthSuccess))
        await act(async () => {})

        expect(result.current.user).toEqual({ uid: 'mock-uid' })
        expect(mockOnAuthSuccess).toHaveBeenCalledWith({ uid: 'mock-uid' })
      })

      it('ignores a corrupt stored mock user', async () => {
        store.PLAYWRIGHT_MOCK_USER = '{not json'

        const { result } = renderHook(() => useAuth(mockOnAuthSuccess))
        await act(async () => {})

        expect(result.current.user).toBeNull()
        expect(mockOnAuthSuccess).not.toHaveBeenCalled()
      })

      it('exposes a window hook for injecting a user mid-test', async () => {
        const { result } = renderHook(() => useAuth(mockOnAuthSuccess))
        const win = window as unknown as {
          setMockUser: (u: unknown) => void
        }

        expect(typeof win.setMockUser).toBe('function')

        await act(async () => {
          win.setMockUser({ uid: 'injected' })
        })

        expect(result.current.user).toEqual({ uid: 'injected' })
        expect(mockOnAuthSuccess).toHaveBeenCalledWith({ uid: 'injected' })
      })

      it('clears the stored mock user on disconnect and skips firebase sign-out', async () => {
        store.PLAYWRIGHT_MOCK_USER = JSON.stringify({ uid: 'mock-uid' })

        const { result } = renderHook(() => useAuth(mockOnAuthSuccess))
        await act(async () => {})
        mockOnAuthSuccess.mockClear()

        await act(async () => {
          await result.current.disconnectAccount()
        })

        expect(localStorage.removeItem).toHaveBeenCalledWith(
          'PLAYWRIGHT_MOCK_USER',
        )
        expect(result.current.user).toBeNull()
        expect(mockOnAuthSuccess).toHaveBeenCalledWith(null)
        expect(auth.signOut).not.toHaveBeenCalled()
      })

      it('still runs the sign-out cleanup before clearing the mock user', async () => {
        const mockOnSignOut = jest.fn().mockResolvedValue(undefined)

        const { result } = renderHook(() =>
          useAuth(mockOnAuthSuccess, mockOnSignOut),
        )

        await act(async () => {
          await result.current.disconnectAccount()
        })

        expect(mockOnSignOut).toHaveBeenCalled()
      })

      it('does not install the window hook when Playwright is off', () => {
        delete process.env.EXPO_PUBLIC_PLAYWRIGHT

        renderHook(() => useAuth(mockOnAuthSuccess))

        expect(
          (window as unknown as { setMockUser?: unknown }).setMockUser,
        ).toBeUndefined()
      })
    })
  })
})
