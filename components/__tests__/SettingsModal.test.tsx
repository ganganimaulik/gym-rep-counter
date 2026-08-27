import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Platform } from 'react-native'
import SettingsModal from '../SettingsModal'

const mockSignInWithEmailAndPassword = jest.fn()
const mockCreateUserWithEmailAndPassword = jest.fn()

// Overrides the global firebase/auth mock so the emulator "Mock Sign In" flow,
// which dynamically imports these two functions, is observable.
jest.mock('firebase/auth', () => ({
  getReactNativePersistence: jest.fn(),
  initializeAuth: jest.fn(),
  getAuth: jest.fn(),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
}))

// Mock dependencies
jest.mock('lucide-react-native', () => {
  return new Proxy(
    {},
    {
      get: () => () => null,
    },
  )
})

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => children,
}))

jest.mock('@react-native-community/slider', () => {
  const { View } = require('react-native')
  return View
})

jest.mock('react-native-toast-message', () => {
  const mockToast = () => null
  mockToast.show = jest.fn()
  mockToast.hide = jest.fn()
  return mockToast
})

describe('SettingsModal', () => {
  const defaultSettings = {
    volume: 0.8,
    countdownSeconds: 5,
    restSeconds: 90,
    maxReps: 12,
    maxSets: 4,
    concentricSeconds: 2,
    eccentricSeconds: 3,
    eccentricCountdownEnabled: true,
    countdownAnnouncementThreshold: 15,
  }

  const mockOnSave = jest.fn()
  const mockOnGoogleButtonPress = jest.fn()
  const mockDisconnectAccount = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders pre-filled settings values', () => {
    const { getByTestId } = render(
      <SettingsModal
        visible={true}
        onClose={jest.fn()}
        settings={defaultSettings}
        onSave={mockOnSave}
        onGoogleButtonPress={mockOnGoogleButtonPress}
        user={null}
        disconnectAccount={mockDisconnectAccount}
        isSigningIn={false}
      />,
    )

    // Inputs should be prefilled
    expect(getByTestId('setting-countdown').props.value).toBe('5')
    expect(getByTestId('setting-rest').props.value).toBe('90')
    expect(getByTestId('setting-concentric').props.value).toBe('2')
    expect(getByTestId('setting-eccentric').props.value).toBe('3')
  })

  it('validates settings and saves correct values on save press', async () => {
    const { getByText, getByTestId } = render(
      <SettingsModal
        visible={true}
        onClose={jest.fn()}
        settings={defaultSettings}
        onSave={mockOnSave}
        onGoogleButtonPress={mockOnGoogleButtonPress}
        user={null}
        disconnectAccount={mockDisconnectAccount}
        isSigningIn={false}
      />,
    )

    // Modify rest seconds and concentric duration
    fireEvent.changeText(getByTestId('setting-rest'), '60')
    fireEvent.changeText(getByTestId('setting-concentric'), '1')

    // Save settings
    fireEvent.press(getByText('Save Changes'))

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        ...defaultSettings,
        restSeconds: 60,
        concentricSeconds: 1,
      })
    })
  })

  it('shows error toast and rejects saving when inputs are invalid/non-numeric', async () => {
    const Toast = require('react-native-toast-message')
    const { getByText, getByTestId } = render(
      <SettingsModal
        visible={true}
        onClose={jest.fn()}
        settings={defaultSettings}
        onSave={mockOnSave}
        onGoogleButtonPress={mockOnGoogleButtonPress}
        user={null}
        disconnectAccount={mockDisconnectAccount}
        isSigningIn={false}
      />,
    )

    // Input invalid string
    fireEvent.changeText(getByTestId('setting-rest'), 'abc')
    fireEvent.press(getByText('Save Changes'))

    expect(mockOnSave).not.toHaveBeenCalled()
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text1: 'Invalid Inputs',
      }),
    )
  })

  it('calls auth callbacks correctly when user is not logged in', () => {
    const { getByTestId } = render(
      <SettingsModal
        visible={true}
        onClose={jest.fn()}
        settings={defaultSettings}
        onSave={mockOnSave}
        onGoogleButtonPress={mockOnGoogleButtonPress}
        user={null} // not logged in
        disconnectAccount={mockDisconnectAccount}
        isSigningIn={false}
      />,
    )

    // Press Sign In button
    const googleButton = getByTestId('google-signin-btn')
    fireEvent.press(googleButton)

    expect(mockOnGoogleButtonPress).toHaveBeenCalled()
  })

  it('calls disconnect account callback when user is logged in', () => {
    const { getByTestId } = render(
      <SettingsModal
        visible={true}
        onClose={jest.fn()}
        settings={defaultSettings}
        onSave={mockOnSave}
        onGoogleButtonPress={mockOnGoogleButtonPress}
        user={{ uid: 'test-user', email: 'user@test.com' } as any} // logged in
        disconnectAccount={mockDisconnectAccount}
        isSigningIn={false}
      />,
    )

    // Press Disconnect button
    const disconnectButton = getByTestId('disconnect-button')
    fireEvent.press(disconnectButton)

    expect(mockDisconnectAccount).toHaveBeenCalled()
  })

  // Renders with defaultSettings plus any overrides, returning the RNTL result.
  const renderModal = (
    overrides: Record<string, unknown> = {},
    props: Record<string, unknown> = {},
  ) =>
    render(
      <SettingsModal
        visible={true}
        onClose={jest.fn()}
        settings={{ ...defaultSettings, ...overrides } as any}
        onSave={mockOnSave}
        onGoogleButtonPress={mockOnGoogleButtonPress}
        user={null}
        disconnectAccount={mockDisconnectAccount}
        isSigningIn={false}
        {...props}
      />,
    )

  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      const { toJSON, queryByText } = render(
        <SettingsModal
          visible={false}
          onClose={jest.fn()}
          settings={defaultSettings}
          onSave={mockOnSave}
          onGoogleButtonPress={mockOnGoogleButtonPress}
          user={null}
          disconnectAccount={mockDisconnectAccount}
          isSigningIn={false}
        />,
      )

      expect(toJSON()).toBeNull()
      expect(queryByText('SETTINGS')).toBeNull()
    })
  })

  describe('syncing with the settings prop', () => {
    it('adopts a newly supplied settings object', () => {
      const { getByTestId, rerender } = renderModal()
      expect(getByTestId('setting-rest').props.value).toBe('90')

      rerender(
        <SettingsModal
          visible={true}
          onClose={jest.fn()}
          settings={{ ...defaultSettings, restSeconds: 120, maxReps: 20 }}
          onSave={mockOnSave}
          onGoogleButtonPress={mockOnGoogleButtonPress}
          user={null}
          disconnectAccount={mockDisconnectAccount}
          isSigningIn={false}
        />,
      )

      expect(getByTestId('setting-rest').props.value).toBe('120')
      expect(getByTestId('setting-max-reps').props.value).toBe('20')
    })

    it('discards unsaved local edits when the settings prop changes', () => {
      const { getByTestId, rerender } = renderModal()

      fireEvent.changeText(getByTestId('setting-rest'), '45')
      expect(getByTestId('setting-rest').props.value).toBe('45')

      // An external save/sync pushes a fresh object down.
      rerender(
        <SettingsModal
          visible={true}
          onClose={jest.fn()}
          settings={{ ...defaultSettings }}
          onSave={mockOnSave}
          onGoogleButtonPress={mockOnGoogleButtonPress}
          user={null}
          disconnectAccount={mockDisconnectAccount}
          isSigningIn={false}
        />,
      )

      expect(getByTestId('setting-rest').props.value).toBe('90')
    })
  })

  describe('numeric validation', () => {
    const numericFields: [string, string][] = [
      ['setting-countdown', 'countdownSeconds'],
      ['setting-announcement', 'countdownAnnouncementThreshold'],
      ['setting-rest', 'restSeconds'],
      ['setting-max-reps', 'maxReps'],
      ['setting-max-sets', 'maxSets'],
      ['setting-concentric', 'concentricSeconds'],
      ['setting-eccentric', 'eccentricSeconds'],
    ]

    it.each(numericFields)('rejects zero for %s', (testID) => {
      const Toast = require('react-native-toast-message')
      const { getByText, getByTestId } = renderModal()

      fireEvent.changeText(getByTestId(testID), '0')
      fireEvent.press(getByText('Save Changes'))

      expect(mockOnSave).not.toHaveBeenCalled()
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text1: 'Invalid Inputs' }),
      )
    })

    it.each(numericFields)('rejects a negative value for %s', (testID) => {
      const { getByText, getByTestId } = renderModal()

      fireEvent.changeText(getByTestId(testID), '-5')
      fireEvent.press(getByText('Save Changes'))

      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('accepts fractional tempo durations', async () => {
      const { getByText, getByTestId } = renderModal()

      fireEvent.changeText(getByTestId('setting-concentric'), '1.5')
      fireEvent.changeText(getByTestId('setting-eccentric'), '2.5')
      fireEvent.press(getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            concentricSeconds: 1.5,
            eccentricSeconds: 2.5,
          }),
        )
      })
    })

    it('reports only once and stops at the first invalid field', () => {
      const Toast = require('react-native-toast-message')
      const { getByText, getByTestId } = renderModal()

      fireEvent.changeText(getByTestId('setting-countdown'), '0')
      fireEvent.changeText(getByTestId('setting-rest'), '0')
      fireEvent.press(getByText('Save Changes'))

      expect(Toast.show).toHaveBeenCalledTimes(1)
    })
  })

  describe('volume', () => {
    it('renders the volume as a whole percentage', () => {
      const { getByText } = renderModal({ volume: 0.8 })

      expect(getByText('80%')).toBeTruthy()
    })

    it('rounds fractional volumes to the nearest percent', () => {
      const { getByText } = renderModal({ volume: 0.756 })

      expect(getByText('76%')).toBeTruthy()
    })

    it('renders muted and full volume ends of the range', () => {
      expect(renderModal({ volume: 0 }).getByText('0%')).toBeTruthy()
      expect(renderModal({ volume: 1 }).getByText('100%')).toBeTruthy()
    })
  })

  describe('eccentric voice countdown toggle', () => {
    it('saves the toggled-off value', async () => {
      const { getByText, getByTestId } = renderModal({
        eccentricCountdownEnabled: true,
      })

      fireEvent(getByTestId('toggle-eccentric-voice'), 'valueChange', false)
      fireEvent.press(getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({ eccentricCountdownEnabled: false }),
        )
      })
    })

    it('reflects the incoming value', () => {
      const { getByTestId } = renderModal({ eccentricCountdownEnabled: false })

      expect(getByTestId('toggle-eccentric-voice').props.value).toBe(false)
    })
  })

  describe('stat reminders', () => {
    it('defaults to enabled when the setting is absent', () => {
      const { getByTestId } = renderModal()

      expect(getByTestId('toggle-stat-reminders').props.value).toBe(true)
    })

    it('always shows the manual quiet-window controls while reminders are on', () => {
      // The quiet window is user-set only: auto-detection was removed because
      // app-activity timestamps cannot locate a sleep window.
      const { getByTestId, getByText } = renderModal()

      expect(getByText('Manual Sleep Settings')).toBeTruthy()
      expect(getByTestId('sleep-start-text')).toBeTruthy()
      expect(getByTestId('sleep-end-text')).toBeTruthy()
    })

    it('hides the quiet-window controls when reminders are turned off', () => {
      const { getByTestId, queryByTestId } = renderModal()

      fireEvent(getByTestId('toggle-stat-reminders'), 'valueChange', false)

      expect(queryByTestId('sleep-start-text')).toBeNull()
      expect(queryByTestId('sleep-end-text')).toBeNull()
    })

    it('saves the disabled reminder preference', async () => {
      const { getByText, getByTestId } = renderModal()

      fireEvent(getByTestId('toggle-stat-reminders'), 'valueChange', false)
      fireEvent.press(getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({ statRemindersEnabled: false }),
        )
      })
    })
  })

  describe('manual sleep window', () => {
    const manual = {}

    it('formats the default bedtime and wake-up hours', () => {
      const { getByTestId } = renderModal(manual)

      expect(getByTestId('sleep-start-text').props.children).toBe('11:00 PM')
      expect(getByTestId('sleep-end-text').props.children).toBe('7:00 AM')
    })

    it('formats midnight as 12:00 AM and noon as 12:00 PM', () => {
      const { getByTestId } = renderModal({
        ...manual,
        statRemindersSleepStart: 0,
        statRemindersSleepEnd: 12,
      })

      expect(getByTestId('sleep-start-text').props.children).toBe('12:00 AM')
      expect(getByTestId('sleep-end-text').props.children).toBe('12:00 PM')
    })

    it('wraps bedtime forward past midnight', () => {
      const { getByTestId } = renderModal({
        ...manual,
        statRemindersSleepStart: 23,
      })

      fireEvent.press(getByTestId('sleep-start-plus'))

      expect(getByTestId('sleep-start-text').props.children).toBe('12:00 AM')
    })

    it('wraps bedtime backward past midnight', () => {
      const { getByTestId } = renderModal({
        ...manual,
        statRemindersSleepStart: 0,
      })

      fireEvent.press(getByTestId('sleep-start-minus'))

      expect(getByTestId('sleep-start-text').props.children).toBe('11:00 PM')
    })

    it('wraps the wake-up hour in both directions', () => {
      const { getByTestId } = renderModal({
        ...manual,
        statRemindersSleepEnd: 0,
      })

      fireEvent.press(getByTestId('sleep-end-minus'))
      expect(getByTestId('sleep-end-text').props.children).toBe('11:00 PM')

      fireEvent.press(getByTestId('sleep-end-plus'))
      expect(getByTestId('sleep-end-text').props.children).toBe('12:00 AM')
    })

    it('saves the adjusted sleep hours', async () => {
      const { getByText, getByTestId } = renderModal({
        ...manual,
        statRemindersSleepStart: 22,
        statRemindersSleepEnd: 6,
      })

      fireEvent.press(getByTestId('sleep-start-plus'))
      fireEvent.press(getByTestId('sleep-end-plus'))
      fireEvent.press(getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            statRemindersSleepStart: 23,
            statRemindersSleepEnd: 7,
          }),
        )
      })
    })
  })

  describe('web sign-in', () => {
    const originalOS = Platform.OS
    const originalEmulator = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR
    const originalPlaywright = process.env.EXPO_PUBLIC_PLAYWRIGHT

    beforeEach(() => {
      Platform.OS = 'web'
    })

    afterEach(() => {
      Platform.OS = originalOS
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = originalEmulator
      process.env.EXPO_PUBLIC_PLAYWRIGHT = originalPlaywright
    })

    it('renders a plain web sign-in button instead of the native Google button', () => {
      const { getByText, queryByTestId } = renderModal()

      expect(getByText('Sign in with Google')).toBeTruthy()
      expect(queryByTestId('google-signin-btn')).toBeNull()
    })

    it('triggers the Google sign-in callback', () => {
      const { getByText } = renderModal()

      fireEvent.press(getByText('Sign in with Google'))

      expect(mockOnGoogleButtonPress).toHaveBeenCalled()
    })

    it('shows in-progress copy while signing in', () => {
      const { getByText, queryByText } = renderModal({}, { isSigningIn: true })

      expect(getByText('Signing in...')).toBeTruthy()
      expect(queryByText('Sign in with Google')).toBeNull()
    })

    it('hides the mock sign-in button when the emulator is not enabled', () => {
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'false'

      const { queryByTestId } = renderModal()

      expect(queryByTestId('mock-login-button')).toBeNull()
    })

    it('shows the mock sign-in button when the emulator is enabled', () => {
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true'

      const { getByTestId, getByText } = renderModal()

      expect(getByTestId('mock-login-button')).toBeTruthy()
      expect(getByText('Mock Sign In')).toBeTruthy()
    })

    it('uses the injected Playwright mock user instead of hitting firebase', async () => {
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true'
      process.env.EXPO_PUBLIC_PLAYWRIGHT = '1'
      const setMockUser = jest.fn()
      ;(window as unknown as { setMockUser?: unknown }).setMockUser =
        setMockUser

      const { getByTestId } = renderModal()

      await act(async () => {
        fireEvent.press(getByTestId('mock-login-button'))
      })

      expect(setMockUser).toHaveBeenCalledWith({
        uid: 'test-user',
        email: 'test@example.com',
        displayName: 'Test User',
      })
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled()

      delete (window as unknown as { setMockUser?: unknown }).setMockUser
    })

    // The remaining "Mock Sign In" branch (no EXPO_PUBLIC_PLAYWRIGHT set) reaches
    // `await import('firebase/auth')`, which Jest's CJS VM cannot execute without
    // --experimental-vm-modules. That emulator path is covered end-to-end in a real
    // browser instead — see e2e/app.spec.ts ("mock-login-button").
  })
})
