import {
  applySharedExerciseFields,
  exerciseNameKey,
  findSharedExerciseFields,
  getSharedExerciseFields,
  hasSharedExerciseFields,
  routinesSharingExercise,
  syncSharedExerciseFields,
} from '../exerciseSync'
import type { Exercise, Workout } from '../../hooks/useData'

const exercise = (overrides: Partial<Exercise> & { id: string }): Exercise => ({
  name: 'Leg Curl',
  sets: 3,
  reps: 15,
  ...overrides,
})

const twoDays = (): Workout[] => [
  {
    id: 'w1',
    name: 'Day 1 (Lower)',
    exercises: [
      exercise({ id: 'a1', name: 'Leg Press', sets: 4, reps: 10 }),
      exercise({ id: 'a2', name: 'Leg Curl of Choice' }),
    ],
  },
  {
    id: 'w2',
    name: 'Day 3 (Lower)',
    exercises: [
      exercise({ id: 'b1', name: 'Squat', sets: 3, reps: 15 }),
      exercise({ id: 'b2', name: 'Leg Curl of Choice', sets: 2, reps: 20 }),
    ],
  },
]

describe('exerciseNameKey', () => {
  test('matches on a trimmed, case-insensitive name', () => {
    expect(exerciseNameKey('  Leg Press ')).toBe(exerciseNameKey('leg press'))
    expect(exerciseNameKey('RDL')).not.toBe(exerciseNameKey('Squat'))
  })
})

describe('getSharedExerciseFields', () => {
  test('collects variants and timing overrides that are present', () => {
    expect(
      getSharedExerciseFields(
        exercise({
          id: 'a1',
          variants: ['Standing', 'Sitting'],
          restSeconds: 90,
        }),
      ),
    ).toEqual({ variants: ['Standing', 'Sitting'], restSeconds: 90 })
  })

  test('omits absent keys rather than setting them to undefined', () => {
    const shared = getSharedExerciseFields(exercise({ id: 'a1' }))
    expect(shared).toEqual({})
    expect('variants' in shared).toBe(false)
    expect('restSeconds' in shared).toBe(false)
  })

  test('ignores sets, reps and weight unit', () => {
    expect(
      getSharedExerciseFields(
        exercise({ id: 'a1', sets: 4, reps: 10, weightUnit: 'plates' }),
      ),
    ).toEqual({})
  })
})

describe('applySharedExerciseFields', () => {
  test('deletes keys the source lacks instead of writing undefined', () => {
    const updated = applySharedExerciseFields(
      exercise({ id: 'b2', variants: ['Standing'], restSeconds: 45 }),
      { countdownSeconds: 3 },
    )

    expect('variants' in updated).toBe(false)
    expect('restSeconds' in updated).toBe(false)
    expect(updated.countdownSeconds).toBe(3)
  })

  test('leaves per-routine programming alone', () => {
    const updated = applySharedExerciseFields(
      exercise({ id: 'b2', sets: 2, reps: 20, weightUnit: 'plates' }),
      { restSeconds: 90 },
    )

    expect(updated).toMatchObject({ sets: 2, reps: 20, weightUnit: 'plates' })
  })
})

describe('hasSharedExerciseFields', () => {
  test('compares variants by value', () => {
    const ex = exercise({ id: 'a1', variants: ['Standing', 'Sitting'] })
    expect(
      hasSharedExerciseFields(ex, { variants: ['Standing', 'Sitting'] }),
    ).toBe(true)
    expect(
      hasSharedExerciseFields(ex, { variants: ['Sitting', 'Standing'] }),
    ).toBe(false)
    expect(hasSharedExerciseFields(ex, {})).toBe(false)
  })
})

describe('syncSharedExerciseFields', () => {
  test('copies variants and timing onto the same exercise in other routines', () => {
    const workouts = twoDays()
    const source = exercise({
      id: 'a2',
      name: 'Leg Curl of Choice',
      variants: ['Seated', 'Lying'],
      restSeconds: 90,
      eccentricSeconds: 2.5,
    })
    workouts[0].exercises[1] = source

    const synced = syncSharedExerciseFields(workouts, source)

    expect(synced[1].exercises[1]).toEqual({
      id: 'b2',
      name: 'Leg Curl of Choice',
      sets: 2,
      reps: 20,
      variants: ['Seated', 'Lying'],
      restSeconds: 90,
      eccentricSeconds: 2.5,
    })
  })

  test('matches names case-insensitively', () => {
    const workouts = twoDays()
    workouts[1].exercises[1] = exercise({
      id: 'b2',
      name: '  leg curl OF choice ',
    })
    const source = exercise({
      id: 'a2',
      name: 'Leg Curl of Choice',
      restSeconds: 90,
    })
    workouts[0].exercises[1] = source

    expect(syncSharedExerciseFields(workouts, source)[1].exercises[1]).toEqual(
      expect.objectContaining({ id: 'b2', restSeconds: 90 }),
    )
  })

  test('clears an override elsewhere when the source no longer has it', () => {
    const workouts = twoDays()
    workouts[1].exercises[1] = exercise({
      id: 'b2',
      name: 'Leg Curl of Choice',
      variants: ['Seated'],
      restSeconds: 90,
    })
    const source = exercise({ id: 'a2', name: 'Leg Curl of Choice' })
    workouts[0].exercises[1] = source

    const synced = syncSharedExerciseFields(workouts, source)

    expect('variants' in synced[1].exercises[1]).toBe(false)
    expect('restSeconds' in synced[1].exercises[1]).toBe(false)
  })

  test('leaves differently named exercises and other fields untouched', () => {
    const workouts = twoDays()
    const source = exercise({
      id: 'a2',
      name: 'Leg Curl of Choice',
      restSeconds: 90,
    })
    workouts[0].exercises[1] = source

    const synced = syncSharedExerciseFields(workouts, source)

    expect(synced[1].exercises[0]).toBe(workouts[1].exercises[0])
    expect(synced[1].exercises[1]).toMatchObject({ sets: 2, reps: 20 })
  })

  test('returns the original array when nothing needs changing', () => {
    const workouts = twoDays()
    const source = workouts[0].exercises[0]

    expect(syncSharedExerciseFields(workouts, source)).toBe(workouts)
  })

  test('syncs duplicates inside the same routine too', () => {
    const workouts: Workout[] = [
      {
        id: 'w1',
        name: 'Day 1',
        exercises: [
          exercise({ id: 'a1', name: 'Calf Raise', restSeconds: 30 }),
          exercise({ id: 'a2', name: 'Calf Raise' }),
        ],
      },
    ]

    const synced = syncSharedExerciseFields(workouts, workouts[0].exercises[0])

    expect(synced[0].exercises[1].restSeconds).toBe(30)
  })
})

describe('findSharedExerciseFields', () => {
  test('returns the shared fields of an existing exercise with that name', () => {
    const workouts = twoDays()
    workouts[0].exercises[1] = exercise({
      id: 'a2',
      name: 'Leg Curl of Choice',
      variants: ['Seated'],
      restSeconds: 90,
    })

    expect(findSharedExerciseFields(workouts, 'leg curl of choice')).toEqual({
      variants: ['Seated'],
      restSeconds: 90,
    })
  })

  test('returns undefined for a name nothing uses', () => {
    expect(findSharedExerciseFields(twoDays(), 'Bench Press')).toBeUndefined()
  })

  test('skips twins that override nothing', () => {
    // Legacy routines can disagree; inherit from the configured one.
    const workouts = twoDays()
    workouts[1].exercises[1] = exercise({
      id: 'b2',
      name: 'Leg Curl of Choice',
      countdownSeconds: 3,
    })

    expect(findSharedExerciseFields(workouts, 'Leg Curl of Choice')).toEqual({
      countdownSeconds: 3,
    })
  })
})

describe('routinesSharingExercise', () => {
  test('names the other routines using the exercise', () => {
    expect(
      routinesSharingExercise(twoDays(), 'Leg Curl of Choice', 'a2'),
    ).toEqual(['Day 3 (Lower)'])
  })

  test('is empty when the name is unique to the edited exercise', () => {
    expect(routinesSharingExercise(twoDays(), 'Leg Press', 'a1')).toEqual([])
  })

  test('lists each routine once', () => {
    const workouts = twoDays()
    workouts[1].exercises.push(
      exercise({ id: 'b3', name: 'Leg Curl of Choice' }),
    )

    expect(
      routinesSharingExercise(workouts, 'Leg Curl of Choice', 'a2'),
    ).toEqual(['Day 3 (Lower)'])
  })
})
