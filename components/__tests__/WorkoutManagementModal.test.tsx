/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import WorkoutManagementModal from '../WorkoutManagementModal'
import { Workout } from '../../hooks/useData'

// Mock react-native-gesture-handler and draggable-flatlist
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    State: {},
  }
})

jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react')
  const FlatList = require('react-native').FlatList
  const MockDraggableFlatList = React.forwardRef((props: any, ref: any) => {
    // Modify renderItem to supply getIndex mock
    const renderItem = ({ item, index }: any) => {
      return props.renderItem({
        item,
        index,
        isActive: false,
        drag: jest.fn(),
        getIndex: () => index,
      })
    }
    return <FlatList {...props} renderItem={renderItem} ref={ref} />
  })
  MockDraggableFlatList.displayName = 'MockDraggableFlatList'
  return {
    __esModule: true,
    default: MockDraggableFlatList,
  }
})

describe('WorkoutManagementModal', () => {
  const mockWorkouts: Workout[] = [
    {
      id: 'w1',
      name: 'Test Workout',
      exercises: [
        { id: 'ex1', name: 'Leg Press', sets: 4, reps: 10 },
        { id: 'ex2', name: 'RDL', sets: 4, reps: 10 },
      ],
    },
  ]

  const mockSetWorkouts = jest.fn()
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders workout management modal and lists exercises', () => {
    const { getByText } = render(
      <WorkoutManagementModal
        visible={true}
        onClose={mockOnClose}
        workouts={mockWorkouts}
        setWorkouts={mockSetWorkouts}
      />,
    )

    // Check if workout title is visible
    expect(getByText('Test Workout')).toBeTruthy()
    // Check if exercises are listed
    expect(getByText('1. Leg Press')).toBeTruthy()
    expect(getByText('2. RDL')).toBeTruthy()
  })

  test('calls setWorkouts with reordered exercises when onDragEnd is triggered', () => {
    const { UNSAFE_getAllByType } = render(
      <WorkoutManagementModal
        visible={true}
        onClose={mockOnClose}
        workouts={mockWorkouts}
        setWorkouts={mockSetWorkouts}
      />,
    )

    // Find all FlatLists (outer is workouts, inner is exercises)
    const flatLists = UNSAFE_getAllByType(require('react-native').FlatList)
    const exerciseList = flatLists[1]
    expect(exerciseList).toBeTruthy()

    // Simulate onDragEnd with reversed exercises data
    const reorderedExercises = [
      { id: 'ex2', name: 'RDL', sets: 4, reps: 10 },
      { id: 'ex1', name: 'Leg Press', sets: 4, reps: 10 },
    ]

    fireEvent(exerciseList, 'dragEnd', { data: reorderedExercises })

    // Verify setWorkouts was called with the reordered exercises
    expect(mockSetWorkouts).toHaveBeenCalledWith([
      {
        id: 'w1',
        name: 'Test Workout',
        exercises: reorderedExercises,
      },
    ])
  })

  test('calls setWorkouts when adding a new exercise to a workout', () => {
    const { getByPlaceholderText, getByText } = render(
      <WorkoutManagementModal
        visible={true}
        onClose={mockOnClose}
        workouts={mockWorkouts}
        setWorkouts={mockSetWorkouts}
      />,
    )

    fireEvent.changeText(
      getByPlaceholderText('Exercise name'),
      'Leg Extensions',
    )
    fireEvent.changeText(getByPlaceholderText('Sets'), '3')
    fireEvent.changeText(getByPlaceholderText('Reps'), '15')
    fireEvent.press(getByText('Add Exercise'))

    expect(mockSetWorkouts).toHaveBeenCalledWith([
      {
        id: 'w1',
        name: 'Test Workout',
        exercises: [
          ...mockWorkouts[0].exercises,
          expect.objectContaining({
            name: 'Leg Extensions',
            sets: 3,
            reps: 15,
          }),
        ],
      },
    ])
  })

  test('calls setWorkouts when deleting a workout', () => {
    const { getByTestId } = render(
      <WorkoutManagementModal
        visible={true}
        onClose={mockOnClose}
        workouts={mockWorkouts}
        setWorkouts={mockSetWorkouts}
      />,
    )

    fireEvent.press(getByTestId('delete-workout-button'))

    expect(mockSetWorkouts).toHaveBeenCalledWith([])
  })
})
