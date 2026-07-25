import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import WorkoutManagementModal from '../WorkoutManagementModal'
import { Workout, Settings } from '../../hooks/useData'

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

  const mockSettings: Settings = {
    countdownSeconds: 5,
    restSeconds: 60,
    maxReps: 15,
    maxSets: 3,
    concentricSeconds: 1,
    eccentricSeconds: 4,
    eccentricCountdownEnabled: true,
    countdownAnnouncementThreshold: 15,
    volume: 1,
  }

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
        settings={mockSettings}
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
        settings={mockSettings}
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
        settings={mockSettings}
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

  test('saves weight unit and variants from the edit exercise overlay', () => {
    const { getByText, getByTestId } = render(
      <WorkoutManagementModal
        visible={true}
        onClose={mockOnClose}
        workouts={mockWorkouts}
        setWorkouts={mockSetWorkouts}
        settings={mockSettings}
      />,
    )

    // Open the edit overlay for the first exercise
    fireEvent.press(getByText('1. Leg Press'))

    fireEvent.press(getByTestId('edit-exercise-unit-plates'))
    fireEvent.changeText(
      getByTestId('edit-exercise-variants'),
      'Standing, Sitting',
    )
    fireEvent.press(getByText('Save'))

    expect(mockSetWorkouts).toHaveBeenCalledWith([
      {
        id: 'w1',
        name: 'Test Workout',
        exercises: [
          {
            id: 'ex1',
            name: 'Leg Press',
            sets: 4,
            reps: 10,
            weightUnit: 'plates',
            variants: ['Standing', 'Sitting'],
          },
          { id: 'ex2', name: 'RDL', sets: 4, reps: 10 },
        ],
      },
    ])
  })

  test('clearing the variants field removes variants from the exercise', () => {
    const workoutsWithVariants: Workout[] = [
      {
        id: 'w1',
        name: 'Test Workout',
        exercises: [
          {
            id: 'ex1',
            name: 'Calf Raise',
            sets: 3,
            reps: 15,
            weightUnit: 'plates',
            variants: ['Standing', 'Sitting'],
          },
        ],
      },
    ]

    const { getByText, getByTestId } = render(
      <WorkoutManagementModal
        visible={true}
        onClose={mockOnClose}
        workouts={workoutsWithVariants}
        setWorkouts={mockSetWorkouts}
        settings={mockSettings}
      />,
    )

    fireEvent.press(getByText('1. Calf Raise'))

    // Existing config should be pre-filled
    expect(getByTestId('edit-exercise-variants').props.value).toBe(
      'Standing, Sitting',
    )

    fireEvent.changeText(getByTestId('edit-exercise-variants'), '')
    fireEvent.press(getByText('Save'))

    expect(mockSetWorkouts).toHaveBeenCalledWith([
      {
        id: 'w1',
        name: 'Test Workout',
        exercises: [
          {
            id: 'ex1',
            name: 'Calf Raise',
            sets: 3,
            reps: 15,
            weightUnit: 'plates',
          },
        ],
      },
    ])
  })

  describe('per-exercise timing overrides', () => {
    const renderModal = (workouts: Workout[]) =>
      render(
        <WorkoutManagementModal
          visible={true}
          onClose={mockOnClose}
          workouts={workouts}
          setWorkouts={mockSetWorkouts}
          settings={mockSettings}
        />,
      )

    const savedExercise = () => mockSetWorkouts.mock.calls[0][0][0].exercises[0]

    test('shows the global value as the placeholder when nothing is overridden', () => {
      const { getByText, getByTestId } = renderModal(mockWorkouts)
      fireEvent.press(getByText('1. Leg Press'))

      const getReady = getByTestId('edit-exercise-timing-countdownSeconds')
      expect(getReady.props.value).toBe('')
      expect(getReady.props.placeholder).toBe('5')
      expect(
        getByTestId('edit-exercise-timing-restSeconds').props.placeholder,
      ).toBe('60')
    })

    test('saves a get ready and rest override on the exercise', () => {
      const { getByText, getByTestId } = renderModal(mockWorkouts)
      fireEvent.press(getByText('1. Leg Press'))

      fireEvent.changeText(
        getByTestId('edit-exercise-timing-countdownSeconds'),
        '10',
      )
      fireEvent.changeText(
        getByTestId('edit-exercise-timing-restSeconds'),
        '90',
      )
      fireEvent.press(getByText('Save'))

      expect(savedExercise()).toEqual(
        expect.objectContaining({
          id: 'ex1',
          countdownSeconds: 10,
          restSeconds: 90,
        }),
      )
    })

    test('keeps a fractional rep tempo', () => {
      const { getByText, getByTestId } = renderModal(mockWorkouts)
      fireEvent.press(getByText('1. Leg Press'))

      fireEvent.changeText(
        getByTestId('edit-exercise-timing-eccentricSeconds'),
        '2.5',
      )
      fireEvent.press(getByText('Save'))

      expect(savedExercise().eccentricSeconds).toBe(2.5)
    })

    test('pre-fills existing overrides and clears them when blanked', () => {
      const withOverrides: Workout[] = [
        {
          id: 'w1',
          name: 'Test Workout',
          exercises: [
            {
              id: 'ex1',
              name: 'Calf Raise',
              sets: 3,
              reps: 15,
              countdownSeconds: 3,
              restSeconds: 45,
            },
          ],
        },
      ]

      const { getByText, getByTestId } = renderModal(withOverrides)
      fireEvent.press(getByText('1. Calf Raise'))

      expect(
        getByTestId('edit-exercise-timing-countdownSeconds').props.value,
      ).toBe('3')
      expect(getByTestId('edit-exercise-timing-restSeconds').props.value).toBe(
        '45',
      )

      fireEvent.changeText(
        getByTestId('edit-exercise-timing-countdownSeconds'),
        '',
      )
      fireEvent.press(getByText('Save'))

      const saved = savedExercise()
      // The key must be absent, not undefined — workouts go to Firestore as-is.
      expect('countdownSeconds' in saved).toBe(false)
      expect(saved.restSeconds).toBe(45)
    })

    test('clamps an out-of-range entry instead of storing it', () => {
      const { getByText, getByTestId } = renderModal(mockWorkouts)
      fireEvent.press(getByText('1. Leg Press'))

      fireEvent.changeText(
        getByTestId('edit-exercise-timing-restSeconds'),
        '99999',
      )
      fireEvent.press(getByText('Save'))

      expect(savedExercise().restSeconds).toBe(600)
    })

    test('summarizes overrides in the exercise row', () => {
      const withOverrides: Workout[] = [
        {
          id: 'w1',
          name: 'Test Workout',
          exercises: [
            {
              id: 'ex1',
              name: 'Calf Raise',
              sets: 3,
              reps: 15,
              restSeconds: 45,
            },
          ],
        },
      ]

      const { getByText } = renderModal(withOverrides)
      expect(getByText('Rest 45s')).toBeTruthy()
    })
  })

  test('calls setWorkouts when deleting a workout', () => {
    const { getByTestId } = render(
      <WorkoutManagementModal
        visible={true}
        onClose={mockOnClose}
        workouts={mockWorkouts}
        setWorkouts={mockSetWorkouts}
        settings={mockSettings}
      />,
    )

    fireEvent.press(getByTestId('delete-workout-button'))

    expect(mockSetWorkouts).toHaveBeenCalledWith([])
  })
})
