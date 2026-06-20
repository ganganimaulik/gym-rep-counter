import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import RepJumper from '../RepJumper'

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock')
  Reanimated.useAnimatedStyle = jest.fn(() => ({}))
  return Reanimated
})

describe('RepJumper', () => {
  it('renders correct number of buttons based on maxReps', () => {
    const mockJumpToRep = jest.fn()
    const mockCurrentRep = { value: 1 } as any

    const { getByText } = render(
      <RepJumper
        maxReps={5}
        currentRep={mockCurrentRep}
        jumpToRep={mockJumpToRep}
      />
    )

    expect(getByText('Jump to Rep')).toBeTruthy()

    for (let i = 1; i <= 5; i++) {
      expect(getByText(i.toString())).toBeTruthy()
    }
  })

  it('calls jumpToRep with the correct rep when a button is pressed', () => {
    const mockJumpToRep = jest.fn()
    const mockCurrentRep = { value: 1 } as any

    const { getByText } = render(
      <RepJumper
        maxReps={5}
        currentRep={mockCurrentRep}
        jumpToRep={mockJumpToRep}
      />
    )

    fireEvent.press(getByText('3'))

    expect(mockJumpToRep).toHaveBeenCalledWith(3)
  })

  it('renders no buttons when maxReps is 0', () => {
    const mockJumpToRep = jest.fn()
    const mockCurrentRep = { value: 1 } as any

    const { queryByText } = render(
      <RepJumper
        maxReps={0}
        currentRep={mockCurrentRep}
        jumpToRep={mockJumpToRep}
      />
    )

    expect(queryByText('1')).toBeNull()
  })
})
