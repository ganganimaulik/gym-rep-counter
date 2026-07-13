import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import Controls from '../Controls'

// Mock dependencies
jest.mock('lucide-react-native', () => {
  return new Proxy(
    {},
    {
      get: () => () => null,
    },
  )
})

describe('Controls', () => {
  const mockRunNextSet = jest.fn()
  const mockStartWorkout = jest.fn()
  const mockStopWorkout = jest.fn()
  const mockPauseWorkout = jest.fn()
  const mockEndSet = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders Start Workout when not running and not resting', () => {
    const { getByText, queryByText } = render(
      <Controls
        isRunning={false}
        isResting={false}
        isRestComplete={false}
        isPaused={false}
        runNextSet={mockRunNextSet}
        startWorkout={mockStartWorkout}
        stopWorkout={mockStopWorkout}
        pauseWorkout={mockPauseWorkout}
        endSet={mockEndSet}
      />,
    )

    const startBtn = getByText('Start Workout')
    fireEvent.press(startBtn)
    expect(mockStartWorkout).toHaveBeenCalled()
    expect(queryByText('Skip Rest')).toBeNull()
  })

  it('renders Skip Rest when resting but rest is not complete', () => {
    const { getByText, queryByText } = render(
      <Controls
        isRunning={false}
        isResting={true}
        isRestComplete={false}
        isPaused={false}
        runNextSet={mockRunNextSet}
        startWorkout={mockStartWorkout}
        stopWorkout={mockStopWorkout}
        pauseWorkout={mockPauseWorkout}
        endSet={mockEndSet}
      />,
    )

    const skipBtn = getByText('Skip Rest')
    fireEvent.press(skipBtn)
    expect(mockRunNextSet).toHaveBeenCalled()
    expect(queryByText('Start Workout')).toBeNull()
  })

  it('renders Start Next Set when resting and rest is complete', () => {
    const { getByText } = render(
      <Controls
        isRunning={false}
        isResting={true}
        isRestComplete={true}
        isPaused={false}
        runNextSet={mockRunNextSet}
        startWorkout={mockStartWorkout}
        stopWorkout={mockStopWorkout}
        pauseWorkout={mockPauseWorkout}
        endSet={mockEndSet}
      />,
    )

    const nextSetBtn = getByText('Start Next Set')
    fireEvent.press(nextSetBtn)
    expect(mockRunNextSet).toHaveBeenCalled()
  })

  it('renders Resume and Reset buttons when running and paused', () => {
    const { getByText } = render(
      <Controls
        isRunning={true}
        isResting={false}
        isRestComplete={false}
        isPaused={true}
        runNextSet={mockRunNextSet}
        startWorkout={mockStartWorkout}
        stopWorkout={mockStopWorkout}
        pauseWorkout={mockPauseWorkout}
        endSet={mockEndSet}
      />,
    )

    const resumeBtn = getByText('Resume')
    fireEvent.press(resumeBtn)
    expect(mockPauseWorkout).toHaveBeenCalled()

    const resetBtn = getByText('Reset')
    fireEvent.press(resetBtn)
    expect(mockStopWorkout).toHaveBeenCalled()
  })

  it('renders Pause, End Set, and Reset buttons when running and not paused', () => {
    const { getByText } = render(
      <Controls
        isRunning={true}
        isResting={false}
        isRestComplete={false}
        isPaused={false}
        runNextSet={mockRunNextSet}
        startWorkout={mockStartWorkout}
        stopWorkout={mockStopWorkout}
        pauseWorkout={mockPauseWorkout}
        endSet={mockEndSet}
      />,
    )

    const pauseBtn = getByText('Pause')
    fireEvent.press(pauseBtn)
    expect(mockPauseWorkout).toHaveBeenCalled()

    const endSetBtn = getByText('End Set')
    fireEvent.press(endSetBtn)
    expect(mockEndSet).toHaveBeenCalled()

    const resetBtn = getByText('Reset')
    fireEvent.press(resetBtn)
    expect(mockStopWorkout).toHaveBeenCalled()
  })
})
