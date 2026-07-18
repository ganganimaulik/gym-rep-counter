import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import WorkoutSelector from '../WorkoutSelector'

// Mock dependencies
jest.mock('lucide-react-native', () => {
  return new Proxy(
    {},
    {
      get: () => () => null,
    },
  )
})

jest.mock('../../WorkoutPicker', () => {
  const { View } = require('react-native')
  return View
})

jest.mock('react-native-toast-message', () => {
  const mockToast = () => null
  mockToast.show = jest.fn()
  mockToast.hide = jest.fn()
  return mockToast
})

describe('WorkoutSelector', () => {
  const mockWorkouts = [
    {
      id: 'w1',
      name: 'Push Day',
      exercises: [
        { id: 'ex1', name: 'Bench Press', reps: 10, sets: 4, order: 1 },
        { id: 'ex2', name: 'Overhead Press', reps: 8, sets: 3, order: 2 },
      ],
    },
  ]

  const mockSettings = {
    maxSets: 4,
    maxReps: 12,
  }

  const mockSelectWorkout = jest.fn()
  const mockSetModalVisible = jest.fn()
  const mockPrevExercise = jest.fn()
  const mockNextExercise = jest.fn()
  const mockIsSetCompleted = jest.fn()
  const mockJumpToSet = jest.fn()
  const mockResetSetsFrom = jest.fn()
  const mockArePreviousSetsCompleted = jest.fn()
  const mockOnAddSet = jest.fn()
  const mockOnSetLongPress = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders current workout exercise details', () => {
    const { getByText } = render(
      <WorkoutSelector
        workouts={mockWorkouts as any}
        currentWorkout={mockWorkouts[0] as any}
        currentExerciseIndex={0}
        settings={mockSettings as any}
        selectWorkout={mockSelectWorkout}
        setModalVisible={mockSetModalVisible}
        prevExercise={mockPrevExercise}
        nextExercise={mockNextExercise}
        isSetCompleted={mockIsSetCompleted}
        activeExerciseId="ex1"
        totalSets={4}
        onAddSet={mockOnAddSet}
        onSetLongPress={mockOnSetLongPress}
        jumpToSet={mockJumpToSet}
        resetSetsFrom={mockResetSetsFrom}
        arePreviousSetsCompleted={mockArePreviousSetsCompleted}
      />,
    )

    expect(getByText('Bench Press')).toBeTruthy()
    expect(getByText('Exercise 1 of 2')).toBeTruthy()
    expect(getByText('Target: 10 Reps')).toBeTruthy()
  })

  it('allows navigation between exercises', () => {
    const { getByText } = render(
      <WorkoutSelector
        workouts={mockWorkouts as any}
        currentWorkout={mockWorkouts[0] as any}
        currentExerciseIndex={0}
        settings={mockSettings as any}
        selectWorkout={mockSelectWorkout}
        setModalVisible={mockSetModalVisible}
        prevExercise={mockPrevExercise}
        nextExercise={mockNextExercise}
        isSetCompleted={mockIsSetCompleted}
        activeExerciseId="ex1"
        totalSets={4}
        onAddSet={mockOnAddSet}
        onSetLongPress={mockOnSetLongPress}
        jumpToSet={mockJumpToSet}
        resetSetsFrom={mockResetSetsFrom}
        arePreviousSetsCompleted={mockArePreviousSetsCompleted}
      />,
    )

    const nextBtn = getByText('Next')
    fireEvent.press(nextBtn)
    expect(mockNextExercise).toHaveBeenCalled()
  })

  it('handles set completion triggers and validation', () => {
    mockArePreviousSetsCompleted.mockReturnValue(true) // allowed to complete
    const { getByTestId } = render(
      <WorkoutSelector
        workouts={mockWorkouts as any}
        currentWorkout={mockWorkouts[0] as any}
        currentExerciseIndex={0}
        settings={mockSettings as any}
        selectWorkout={mockSelectWorkout}
        setModalVisible={mockSetModalVisible}
        prevExercise={mockPrevExercise}
        nextExercise={mockNextExercise}
        isSetCompleted={mockIsSetCompleted}
        activeExerciseId="ex1"
        totalSets={4}
        onAddSet={mockOnAddSet}
        onSetLongPress={mockOnSetLongPress}
        jumpToSet={mockJumpToSet}
        resetSetsFrom={mockResetSetsFrom}
        arePreviousSetsCompleted={mockArePreviousSetsCompleted}
      />,
    )

    const set2Btn = getByTestId('set-tracker-button-2')
    fireEvent.press(set2Btn)

    expect(mockResetSetsFrom).toHaveBeenCalledWith('ex1', 2)
    expect(mockJumpToSet).toHaveBeenCalledWith(2)
  })

  it('shows error toast when trying to skip sets', () => {
    mockArePreviousSetsCompleted.mockReturnValue(false) // not allowed
    const Toast = require('react-native-toast-message')

    const { getByTestId } = render(
      <WorkoutSelector
        workouts={mockWorkouts as any}
        currentWorkout={mockWorkouts[0] as any}
        currentExerciseIndex={0}
        settings={mockSettings as any}
        selectWorkout={mockSelectWorkout}
        setModalVisible={mockSetModalVisible}
        prevExercise={mockPrevExercise}
        nextExercise={mockNextExercise}
        isSetCompleted={mockIsSetCompleted}
        activeExerciseId="ex1"
        totalSets={4}
        onAddSet={mockOnAddSet}
        onSetLongPress={mockOnSetLongPress}
        jumpToSet={mockJumpToSet}
        resetSetsFrom={mockResetSetsFrom}
        arePreviousSetsCompleted={mockArePreviousSetsCompleted}
      />,
    )

    const set3Btn = getByTestId('set-tracker-button-3')
    fireEvent.press(set3Btn)

    expect(mockResetSetsFrom).not.toHaveBeenCalled()
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text1: 'Cannot Skip Sets',
      }),
    )
  })

  it('renders a set circle per totalSets and calls onAddSet when "+" is pressed', () => {
    const { getByTestId, queryByTestId } = render(
      <WorkoutSelector
        workouts={mockWorkouts as any}
        currentWorkout={mockWorkouts[0] as any}
        currentExerciseIndex={0}
        settings={mockSettings as any}
        selectWorkout={mockSelectWorkout}
        setModalVisible={mockSetModalVisible}
        prevExercise={mockPrevExercise}
        nextExercise={mockNextExercise}
        isSetCompleted={mockIsSetCompleted}
        activeExerciseId="ex1"
        totalSets={5}
        onAddSet={mockOnAddSet}
        onSetLongPress={mockOnSetLongPress}
        jumpToSet={mockJumpToSet}
        resetSetsFrom={mockResetSetsFrom}
        arePreviousSetsCompleted={mockArePreviousSetsCompleted}
      />,
    )

    // totalSets drives the circle count (5 here, exceeding the routine's 4)
    expect(getByTestId('set-tracker-button-5')).toBeTruthy()
    expect(queryByTestId('set-tracker-button-6')).toBeNull()

    fireEvent.press(getByTestId('add-set-button'))
    expect(mockOnAddSet).toHaveBeenCalledTimes(1)
  })

  it('calls onSetLongPress with the set number on long press', () => {
    const { getByTestId } = render(
      <WorkoutSelector
        workouts={mockWorkouts as any}
        currentWorkout={mockWorkouts[0] as any}
        currentExerciseIndex={0}
        settings={mockSettings as any}
        selectWorkout={mockSelectWorkout}
        setModalVisible={mockSetModalVisible}
        prevExercise={mockPrevExercise}
        nextExercise={mockNextExercise}
        isSetCompleted={mockIsSetCompleted}
        activeExerciseId="ex1"
        totalSets={4}
        onAddSet={mockOnAddSet}
        onSetLongPress={mockOnSetLongPress}
        jumpToSet={mockJumpToSet}
        resetSetsFrom={mockResetSetsFrom}
        arePreviousSetsCompleted={mockArePreviousSetsCompleted}
      />,
    )

    fireEvent(getByTestId('set-tracker-button-3'), 'longPress')

    expect(mockOnSetLongPress).toHaveBeenCalledWith(3)
    // A long press must not trigger the tap behavior (redo-from-set)
    expect(mockJumpToSet).not.toHaveBeenCalled()
    expect(mockResetSetsFrom).not.toHaveBeenCalled()
  })
})
