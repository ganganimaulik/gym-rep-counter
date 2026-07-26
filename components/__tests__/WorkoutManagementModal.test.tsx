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

  describe('variants and timing shared across routines', () => {
    const sharedNameWorkouts: Workout[] = [
      {
        id: 'w1',
        name: 'Day 1 (Lower)',
        exercises: [
          { id: 'ex1', name: 'Leg Curl of Choice', sets: 3, reps: 15 },
        ],
      },
      {
        id: 'w2',
        name: 'Day 3 (Lower)',
        exercises: [
          { id: 'ex2', name: 'leg curl of choice', sets: 2, reps: 20 },
          { id: 'ex3', name: 'Squat', sets: 3, reps: 15 },
        ],
      },
    ]

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

    const savedWorkouts = (): Workout[] => mockSetWorkouts.mock.calls[0][0]

    test('propagates variants and timing to the same exercise in another routine', () => {
      const { getByText, getByTestId } = renderModal(sharedNameWorkouts)

      fireEvent.press(getByText('1. Leg Curl of Choice'))
      fireEvent.changeText(
        getByTestId('edit-exercise-variants'),
        'Seated, Lying',
      )
      fireEvent.changeText(
        getByTestId('edit-exercise-timing-restSeconds'),
        '90',
      )
      fireEvent.press(getByText('Save'))

      expect(savedWorkouts()[1].exercises[0]).toEqual({
        id: 'ex2',
        // Only the shared fields travel — name, sets and reps stay put.
        name: 'leg curl of choice',
        sets: 2,
        reps: 20,
        variants: ['Seated', 'Lying'],
        restSeconds: 90,
      })
      expect(savedWorkouts()[1].exercises[1]).toEqual({
        id: 'ex3',
        name: 'Squat',
        sets: 3,
        reps: 15,
      })
    })

    test('clears the twin override when the source override is blanked', () => {
      const withOverrides: Workout[] = [
        {
          id: 'w1',
          name: 'Day 1 (Lower)',
          exercises: [
            {
              id: 'ex1',
              name: 'Calf Raise',
              sets: 3,
              reps: 15,
              variants: ['Standing'],
              restSeconds: 45,
            },
          ],
        },
        {
          id: 'w2',
          name: 'Day 3 (Lower)',
          exercises: [
            {
              id: 'ex2',
              name: 'Calf Raise',
              sets: 2,
              reps: 20,
              variants: ['Standing'],
              restSeconds: 45,
            },
          ],
        },
      ]

      const { getAllByText, getByText, getByTestId } =
        renderModal(withOverrides)

      // Both routines render the row; edit the one in Day 1.
      fireEvent.press(getAllByText('1. Calf Raise')[0])
      fireEvent.changeText(getByTestId('edit-exercise-variants'), '')
      fireEvent.changeText(getByTestId('edit-exercise-timing-restSeconds'), '')
      fireEvent.press(getByText('Save'))

      const twin = savedWorkouts()[1].exercises[0]
      // Keys must be absent, not undefined — workouts go to Firestore as-is.
      expect('variants' in twin).toBe(false)
      expect('restSeconds' in twin).toBe(false)
      expect(twin).toMatchObject({ sets: 2, reps: 20 })
    })

    test('a renamed exercise stops syncing with its old twin', () => {
      const { getByText, getByTestId } = renderModal(sharedNameWorkouts)

      fireEvent.press(getByText('1. Leg Curl of Choice'))
      fireEvent.changeText(getByTestId('edit-exercise-name'), 'Seated Leg Curl')
      fireEvent.changeText(
        getByTestId('edit-exercise-timing-restSeconds'),
        '90',
      )
      fireEvent.press(getByText('Save'))

      expect(savedWorkouts()[0].exercises[0]).toMatchObject({
        name: 'Seated Leg Curl',
        restSeconds: 90,
      })
      expect('restSeconds' in savedWorkouts()[1].exercises[0]).toBe(false)
    })

    test('an exercise added under an existing name inherits its variants and timing', () => {
      const { getAllByText, getAllByPlaceholderText } = renderModal([
        {
          id: 'w1',
          name: 'Day 1 (Lower)',
          exercises: [
            {
              id: 'ex1',
              name: 'Calf Raise',
              sets: 3,
              reps: 15,
              variants: ['Standing'],
              restSeconds: 45,
            },
          ],
        },
        { id: 'w2', name: 'Day 3 (Lower)', exercises: [] },
      ])

      fireEvent.changeText(
        getAllByPlaceholderText('Exercise name')[1],
        'calf raise',
      )
      fireEvent.changeText(getAllByPlaceholderText('Sets')[1], '2')
      fireEvent.press(getAllByText('Add Exercise')[1])

      expect(savedWorkouts()[1].exercises[0]).toEqual(
        expect.objectContaining({
          name: 'calf raise',
          variants: ['Standing'],
          restSeconds: 45,
        }),
      )
    })

    test('warns which routines the edit will also change', () => {
      const { getByText, getByTestId, queryByTestId } =
        renderModal(sharedNameWorkouts)

      fireEvent.press(getByText('1. Leg Curl of Choice'))
      expect(getByTestId('edit-exercise-shared-note')).toHaveTextContent(
        /Day 3 \(Lower\)/,
      )

      // Renaming to something unique drops the warning.
      fireEvent.changeText(getByTestId('edit-exercise-name'), 'Seated Leg Curl')
      expect(queryByTestId('edit-exercise-shared-note')).toBeNull()
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
