import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import UserProfile from '../UserProfile'
import type { User as FirebaseUser } from 'firebase/auth'

describe('UserProfile', () => {
  const mockDisconnectAccount = jest.fn()

  const mockUser: FirebaseUser = {
    uid: '123',
    email: 'test@example.com',
    emailVerified: true,
    displayName: 'Test User',
    isAnonymous: false,
    photoURL: 'https://example.com/photo.jpg',
    providerData: [],
    metadata: {},
    tenantId: null,
    refreshToken: '',
    phoneNumber: null,
    providerId: '',
    delete: jest.fn(),
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    reload: jest.fn(),
    toJSON: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly with user data', () => {
    const { getByText, getByTestId } = render(
      <UserProfile user={mockUser} disconnectAccount={mockDisconnectAccount} />
    )

    expect(getByText('Test User')).toBeTruthy()
    expect(getByText('test@example.com')).toBeTruthy()
    expect(getByTestId('user-profile-image')).toBeTruthy()
  })

  it('does not render image when user has no photoURL', () => {
    const userWithoutPhoto = { ...mockUser, photoURL: null }
    const { getByText, queryByTestId } = render(
      <UserProfile user={userWithoutPhoto} disconnectAccount={mockDisconnectAccount} />
    )

    expect(getByText('Test User')).toBeTruthy()
    expect(getByText('test@example.com')).toBeTruthy()
    expect(queryByTestId('user-profile-image')).toBeNull()
  })

  it('returns null when user is null', () => {
    const { toJSON } = render(
      <UserProfile user={null} disconnectAccount={mockDisconnectAccount} />
    )

    expect(toJSON()).toBeNull()
  })

  it('calls disconnectAccount when logout button is pressed', () => {
    const { getByTestId } = render(
      <UserProfile user={mockUser} disconnectAccount={mockDisconnectAccount} />
    )

    const disconnectBtn = getByTestId('disconnect-button')
    fireEvent.press(disconnectBtn)

    expect(mockDisconnectAccount).toHaveBeenCalledTimes(1)
  })
})
