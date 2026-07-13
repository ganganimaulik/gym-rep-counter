import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import SettingsModal from '../SettingsModal'

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
        detectedSleepWindow={null}
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
        detectedSleepWindow={null}
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
        detectedSleepWindow={null}
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
        detectedSleepWindow={null}
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
        detectedSleepWindow={null}
      />,
    )

    // Press Disconnect button
    const disconnectButton = getByTestId('disconnect-button')
    fireEvent.press(disconnectButton)

    expect(mockDisconnectAccount).toHaveBeenCalled()
  })
})
