import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import UserProfile from '../UserProfile';
import type { User as FirebaseUser } from 'firebase/auth';

describe('UserProfile', () => {
  const mockDisconnectAccount = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser: Partial<FirebaseUser> = {
    displayName: 'Test User',
    email: 'test@example.com',
    photoURL: 'https://example.com/photo.jpg',
  };

  it('renders null when no user is provided', () => {
    const { toJSON } = render(
      <UserProfile user={null} disconnectAccount={mockDisconnectAccount} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders user details correctly', () => {
    const { getByText, getByTestId } = render(
      <UserProfile user={mockUser as FirebaseUser} disconnectAccount={mockDisconnectAccount} />
    );

    expect(getByText('Test User')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();

    const image = getByTestId('user-profile-image');
    expect(image.props.source.uri).toBe('https://example.com/photo.jpg');
  });

  it('renders correctly without photoURL', () => {
    const userWithoutPhoto = { ...mockUser, photoURL: null };
    const { queryByTestId } = render(
      <UserProfile user={userWithoutPhoto as unknown as FirebaseUser} disconnectAccount={mockDisconnectAccount} />
    );

    expect(queryByTestId('user-profile-image')).toBeNull();
  });

  it('calls disconnectAccount when logout button is pressed', () => {
    const { getByTestId } = render(
      <UserProfile user={mockUser as FirebaseUser} disconnectAccount={mockDisconnectAccount} />
    );

    const button = getByTestId('disconnect-account-button');
    fireEvent.press(button);

    expect(mockDisconnectAccount).toHaveBeenCalledTimes(1);
  });
});
