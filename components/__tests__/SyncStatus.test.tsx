import React from 'react'
import { render } from '@testing-library/react-native'
import SyncStatus from '../SyncStatus'
import type { User as FirebaseUser } from 'firebase/auth'

describe('SyncStatus', () => {
  it('renders synced status when user is provided', () => {
    const mockUser = { uid: '123', email: 'test@example.com' } as FirebaseUser
    const { getByText } = render(<SyncStatus user={mockUser} />)

    expect(getByText('Settings are synced to your account.')).toBeTruthy()
  })

  it('renders local status when user is null', () => {
    const { getByText } = render(<SyncStatus user={null} />)

    expect(getByText('Settings are saved on this device only.')).toBeTruthy()
  })
})
