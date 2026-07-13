import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import MainDisplay from '../MainDisplay'

// Mock dependencies
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock')
  Reanimated.useAnimatedProps = (callback: any) => callback()
  return Reanimated
})

describe('MainDisplay', () => {
  const mockStatusText = { value: 'Get Ready!' }
  const mockCurrentRep = { value: 2 }
  const mockCurrentSet = { value: 3 }
  const mockAddCountdownTime = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders reps and sets correctly in Concentric phase', () => {
    const { getByTestId, queryByTestId } = render(
      <MainDisplay
        statusText={mockStatusText as any}
        currentRep={mockCurrentRep as any}
        currentSet={mockCurrentSet as any}
        phase="Concentric"
        addCountdownTime={mockAddCountdownTime}
      />,
    )

    expect(getByTestId('main-display-reps').props.defaultValue).toBe('2')
    expect(getByTestId('main-display-sets').props.defaultValue).toBe('3')
    expect(queryByTestId('main-display-status')).toBeNull()
  })

  it('renders status text correctly in Get Ready phase', () => {
    const { getByTestId, queryByTestId } = render(
      <MainDisplay
        statusText={mockStatusText as any}
        currentRep={mockCurrentRep as any}
        currentSet={mockCurrentSet as any}
        phase="Get Ready"
        addCountdownTime={mockAddCountdownTime}
      />,
    )

    expect(getByTestId('main-display-status').props.defaultValue).toBe(
      'Get Ready!',
    )
    expect(queryByTestId('main-display-reps')).toBeNull()
  })

  it('calls addCountdownTime when pressed in Get Ready phase', () => {
    const { getByTestId } = render(
      <MainDisplay
        statusText={mockStatusText as any}
        currentRep={mockCurrentRep as any}
        currentSet={mockCurrentSet as any}
        phase="Get Ready"
        addCountdownTime={mockAddCountdownTime}
      />,
    )

    const mainDisplayPressable = getByTestId('main-display-pressable')
    fireEvent.press(mainDisplayPressable)

    expect(mockAddCountdownTime).toHaveBeenCalled()
  })

  it('does not call addCountdownTime when pressed in Concentric phase', () => {
    const { getByTestId } = render(
      <MainDisplay
        statusText={mockStatusText as any}
        currentRep={mockCurrentRep as any}
        currentSet={mockCurrentSet as any}
        phase="Concentric"
        addCountdownTime={mockAddCountdownTime}
      />,
    )

    const mainDisplayPressable = getByTestId('main-display-pressable')
    fireEvent.press(mainDisplayPressable)

    expect(mockAddCountdownTime).not.toHaveBeenCalled()
  })
})
