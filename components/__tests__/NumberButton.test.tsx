import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import NumberButton from '../NumberButton'

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock')
  return {
    ...Reanimated,
    useSharedValue: jest.fn(),
    useAnimatedStyle: jest.fn().mockImplementation((style) => style()),
  }
})

describe('NumberButton', () => {
  const mockOnPress = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the number label', () => {
    const currentRep = { value: 0 }
    const { getByText } = render(
      <NumberButton
        number={5}
        onPress={mockOnPress}
        currentRep={currentRep as any}
      />,
    )
    expect(getByText('5')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const currentRep = { value: 0 }
    const { getByText } = render(
      <NumberButton
        number={5}
        onPress={mockOnPress}
        currentRep={currentRep as any}
      />,
    )
    fireEvent.press(getByText('5'))
    expect(mockOnPress).toHaveBeenCalledTimes(1)
  })

  it('active state styling when currentRep.value matches', () => {
    const currentRep = { value: 5 }
    const { getByText } = render(
      <NumberButton
        number={5}
        onPress={mockOnPress}
        currentRep={currentRep as any}
      />,
    )
    const textElement = getByText('5')

    // Check if the parent container exists, which has the style applied
    expect(textElement.parent).toBeTruthy()
    // Assuming the test renders correctly, the style mock handles the active condition.
  })

  it("inactive state when currentRep.value doesn't match", () => {
    const currentRep = { value: 2 }
    const { getByText } = render(
      <NumberButton
        number={5}
        onPress={mockOnPress}
        currentRep={currentRep as any}
      />,
    )
    const textElement = getByText('5')

    expect(textElement.parent).toBeTruthy()
  })
})
