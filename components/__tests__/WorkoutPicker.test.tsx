import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import WorkoutPicker from '../WorkoutPicker'

jest.mock('lucide-react-native', () => ({
  ChevronDown: () => null,
}))

describe('WorkoutPicker', () => {
  const mockWorkouts = [
    { id: 'w1', name: 'Push Day', exercises: [] },
    { id: 'w2', name: 'Pull Day', exercises: [] },
  ]
  const mockOnValueChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders "Select a workout..." when no workout selected', () => {
    const { getByText } = render(
      <WorkoutPicker
        selectedValue={null}
        onValueChange={mockOnValueChange}
        workouts={mockWorkouts as any}
      />,
    )
    expect(getByText('Select a workout...')).toBeTruthy()
  })

  it('renders selected workout name', () => {
    const { getByText } = render(
      <WorkoutPicker
        selectedValue="w1"
        onValueChange={mockOnValueChange}
        workouts={mockWorkouts as any}
      />,
    )
    expect(getByText('Push Day')).toBeTruthy()
  })

  it('opens modal on press', () => {
    const { getByText } = render(
      <WorkoutPicker
        selectedValue={null}
        onValueChange={mockOnValueChange}
        workouts={mockWorkouts as any}
      />,
    )

    const pickerButton = getByText('Select a workout...')
    fireEvent.press(pickerButton)
    expect(getByText('Select a Workout')).toBeTruthy()
  })

  it('selecting a workout calls onValueChange and closes modal', () => {
    const { getByText } = render(
      <WorkoutPicker
        selectedValue={null}
        onValueChange={mockOnValueChange}
        workouts={mockWorkouts as any}
      />,
    )

    fireEvent.press(getByText('Select a workout...'))
    fireEvent.press(getByText('Push Day'))

    expect(mockOnValueChange).toHaveBeenCalledWith('w1')
  })

  it('cancel button closes modal', () => {
    const { getByText } = render(
      <WorkoutPicker
        selectedValue={null}
        onValueChange={mockOnValueChange}
        workouts={mockWorkouts as any}
      />,
    )

    fireEvent.press(getByText('Select a workout...'))
    expect(getByText('Select a Workout')).toBeTruthy()

    fireEvent.press(getByText('Cancel'))
  })

  it('renders all workout items in the list', () => {
    const { getByText } = render(
      <WorkoutPicker
        selectedValue={null}
        onValueChange={mockOnValueChange}
        workouts={mockWorkouts as any}
      />,
    )

    fireEvent.press(getByText('Select a workout...'))
    expect(getByText('Push Day')).toBeTruthy()
    expect(getByText('Pull Day')).toBeTruthy()
  })
})
