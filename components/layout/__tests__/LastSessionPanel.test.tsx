import React from 'react'
import { render } from '@testing-library/react-native'
import LastSessionPanel from '../LastSessionPanel'
import type { LastSession } from '../../../utils/lastSession'
import type { WorkoutSet, WeightUnit } from '../../../declarations'

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

const TODAY = '2026-07-25'
const SESSION_DAY = '2026-07-22'

const set = (
  setNumber: number,
  weight: number,
  reps: number,
  extra: { weightUnit?: WeightUnit; variant?: string } = {},
): WorkoutSet =>
  ({
    id: `s${setNumber}`,
    workoutId: 'w1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    weight,
    reps,
    set: setNumber,
    ...extra,
    date: {
      toDate: () => new Date(2026, 6, 22, 12),
      toMillis: () => new Date(2026, 6, 22, 12).getTime(),
    },
  }) as unknown as WorkoutSet

const session: LastSession = {
  dateKey: SESSION_DAY,
  sets: [set(1, 60, 12), set(2, 60, 11), set(3, 57.5, 8)],
}

describe('LastSessionPanel', () => {
  it('renders nothing when there is no previous session', () => {
    const { queryByTestId } = render(
      <LastSessionPanel session={null} currentSet={1} todayKey={TODAY} />,
    )
    expect(queryByTestId('last-session-panel')).toBeNull()
  })

  it('renders nothing for a session with no sets', () => {
    const { queryByTestId } = render(
      <LastSessionPanel
        session={{ dateKey: SESSION_DAY, sets: [] }}
        currentSet={1}
        todayKey={TODAY}
      />,
    )
    expect(queryByTestId('last-session-panel')).toBeNull()
  })

  // The chips are the only place the numbers appear — there is no separate
  // headline duplicating the upcoming set.
  const selected = (utils: ReturnType<typeof render>, setNumber: number) =>
    utils.getByTestId(`last-session-chip-${setNumber}`).props.accessibilityState
      ?.selected

  it('shows a chip per set and says how long ago it was', () => {
    const utils = render(
      <LastSessionPanel session={session} currentSet={2} todayKey={TODAY} />,
    )

    expect(utils.getByTestId('last-session-panel')).toBeTruthy()
    expect(utils.getByTestId('last-session-when').props.children).toBe(
      '3 days ago',
    )
    expect(utils.getByText('60×12')).toBeTruthy()
    expect(utils.getByText('60×11')).toBeTruthy()
    expect(utils.getByText('57.5×8')).toBeTruthy()
  })

  it('marks only the upcoming set as selected', () => {
    const utils = render(
      <LastSessionPanel session={session} currentSet={2} todayKey={TODAY} />,
    )

    expect(selected(utils, 1)).toBe(false)
    expect(selected(utils, 2)).toBe(true)
    expect(selected(utils, 3)).toBe(false)
  })

  it('falls back to the closest earlier set when last session was shorter', () => {
    const utils = render(
      <LastSessionPanel session={session} currentSet={5} todayKey={TODAY} />,
    )

    // Set 5 didn't exist last time — mark set 3 instead.
    expect(selected(utils, 3)).toBe(true)
    expect(selected(utils, 1)).toBe(false)
  })

  it('shows the variant that was logged', () => {
    const { getByText } = render(
      <LastSessionPanel
        session={{
          dateKey: SESSION_DAY,
          sets: [set(1, 4, 12, { weightUnit: 'plates', variant: 'Standing' })],
        }}
        currentSet={1}
        todayKey={TODAY}
      />,
    )

    expect(getByText('4×12')).toBeTruthy()
    expect(getByText('· Standing')).toBeTruthy()
  })

  it('shows the chip for a single-set session', () => {
    const { getByTestId } = render(
      <LastSessionPanel
        session={{ dateKey: SESSION_DAY, sets: [set(1, 60, 10)] }}
        currentSet={1}
        todayKey={TODAY}
      />,
    )

    expect(getByTestId('last-session-chip-1')).toBeTruthy()
  })

  it('drops sets that logged neither weight nor reps', () => {
    const { getByTestId, queryByTestId } = render(
      <LastSessionPanel
        session={{
          dateKey: SESSION_DAY,
          sets: [set(1, 60, 10), set(2, 0, 0)],
        }}
        currentSet={1}
        todayKey={TODAY}
      />,
    )

    expect(getByTestId('last-session-chip-1')).toBeTruthy()
    expect(queryByTestId('last-session-chip-2')).toBeNull()
  })

  it('renders nothing when no logged set has weight or reps', () => {
    const { queryByTestId } = render(
      <LastSessionPanel
        session={{ dateKey: SESSION_DAY, sets: [set(1, 0, 0)] }}
        currentSet={1}
        todayKey={TODAY}
      />,
    )

    expect(queryByTestId('last-session-panel')).toBeNull()
  })
})
