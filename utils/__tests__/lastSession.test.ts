import {
  describeRelativeDay,
  formatLoad,
  formatSetChip,
  formatSetSummary,
  resolveSetForNumber,
  selectLastSession,
} from '../lastSession'
import type { WorkoutSet } from '../../declarations'
import { Timestamp } from 'firebase/firestore'

// Same shape as the analyticsUtils suite's mock — the real SDK isn't loadable
// under Jest and only toDate/toMillis are exercised here.
jest.mock('firebase/firestore', () => ({
  Timestamp: class {
    seconds: number
    nanoseconds: number
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds
      this.nanoseconds = nanoseconds
    }
    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1000000)
    }
    toMillis() {
      return this.seconds * 1000 + this.nanoseconds / 1000000
    }
  },
}))

const TODAY = '2026-07-25'

// Build a set logged at noon on the given local day, so the local-date grouping
// can't be flipped by a timezone offset.
const setOn = (
  day: string,
  overrides: Partial<WorkoutSet> & { set: number },
): WorkoutSet => {
  const [year, month, date] = day.split('-').map(Number)
  const at = new Date(year, month - 1, date, 12, 0, 0)
  return {
    id: `${day}-${overrides.set}`,
    workoutId: 'w1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    weight: 60,
    reps: 10,
    date: new Timestamp(Math.floor(at.getTime() / 1000), 0),
    ...overrides,
  }
}

describe('selectLastSession', () => {
  it('returns null when there is no history', () => {
    expect(selectLastSession([], TODAY)).toBeNull()
  })

  it('ignores today so it reports the previous session', () => {
    const session = selectLastSession(
      [
        setOn('2026-07-25', { set: 1, weight: 65 }),
        setOn('2026-07-22', { set: 1, weight: 60 }),
      ],
      TODAY,
    )

    expect(session?.dateKey).toBe('2026-07-22')
    expect(session?.sets).toHaveLength(1)
    expect(session?.sets[0].weight).toBe(60)
  })

  it('returns null when the only history is today', () => {
    expect(
      selectLastSession([setOn('2026-07-25', { set: 1 })], TODAY),
    ).toBeNull()
  })

  it('picks the most recent earlier day and sorts its sets by set number', () => {
    const session = selectLastSession(
      [
        setOn('2026-07-22', { set: 3, weight: 57.5 }),
        setOn('2026-07-22', { set: 1, weight: 60 }),
        setOn('2026-07-22', { set: 2, weight: 60 }),
        setOn('2026-07-10', { set: 1, weight: 50 }),
      ],
      TODAY,
    )

    expect(session?.dateKey).toBe('2026-07-22')
    expect(session?.sets.map((s) => s.set)).toEqual([1, 2, 3])
    expect(session?.sets.map((s) => s.weight)).toEqual([60, 60, 57.5])
  })

  it('sorts across month and year boundaries by date, not string order', () => {
    const session = selectLastSession(
      [
        setOn('2025-12-31', { set: 1, weight: 40 }),
        setOn('2026-01-02', { set: 1, weight: 45 }),
      ],
      TODAY,
    )

    expect(session?.dateKey).toBe('2026-01-02')
  })

  it('skips entries with a missing or unusable date', () => {
    const broken = {
      ...setOn('2026-07-22', { set: 1 }),
      date: undefined,
    } as unknown as WorkoutSet
    const throwing = {
      ...setOn('2026-07-22', { set: 2 }),
      date: {
        toDate: () => {
          throw new Error('bad timestamp')
        },
      },
    } as unknown as WorkoutSet

    const session = selectLastSession(
      [broken, throwing, setOn('2026-07-21', { set: 1, weight: 55 })],
      TODAY,
    )

    expect(session?.dateKey).toBe('2026-07-21')
    expect(session?.sets[0].weight).toBe(55)
  })
})

describe('resolveSetForNumber', () => {
  const session = {
    dateKey: '2026-07-22',
    sets: [
      setOn('2026-07-22', { set: 1, weight: 60, reps: 12 }),
      setOn('2026-07-22', { set: 2, weight: 60, reps: 11 }),
      setOn('2026-07-22', { set: 3, weight: 57.5, reps: 8 }),
    ],
  }

  it('matches the same set number', () => {
    expect(resolveSetForNumber(session, 2)?.reps).toBe(11)
  })

  it('falls back to the last set when last session was shorter', () => {
    expect(resolveSetForNumber(session, 5)?.set).toBe(3)
  })

  it('falls back to the first set when nothing earlier exists', () => {
    const partial = { dateKey: '2026-07-22', sets: [session.sets[2]] }
    expect(resolveSetForNumber(partial, 1)?.set).toBe(3)
  })

  it('returns null for an empty session', () => {
    expect(
      resolveSetForNumber({ dateKey: '2026-07-22', sets: [] }, 1),
    ).toBeNull()
  })
})

describe('formatting', () => {
  it('formats kg and plate loads, pluralizing plates', () => {
    expect(formatLoad(setOn('2026-07-22', { set: 1, weight: 60 }))).toBe(
      '60 kg',
    )
    expect(
      formatLoad(
        setOn('2026-07-22', { set: 1, weight: 4, weightUnit: 'plates' }),
      ),
    ).toBe('4 plates')
    expect(
      formatLoad(
        setOn('2026-07-22', { set: 1, weight: 1, weightUnit: 'plates' }),
      ),
    ).toBe('1 plate')
  })

  it('treats a missing weight as no load', () => {
    expect(formatLoad(setOn('2026-07-22', { set: 1, weight: 0 }))).toBe('')
  })

  it('keeps decimal weights intact', () => {
    expect(
      formatSetSummary(setOn('2026-07-22', { set: 1, weight: 22.5, reps: 10 })),
    ).toBe('22.5 kg × 10')
  })

  it('falls back to reps when no weight was logged', () => {
    expect(
      formatSetSummary(setOn('2026-07-22', { set: 1, weight: 0, reps: 12 })),
    ).toBe('12 reps')
  })

  it('returns an empty summary when there is nothing to show', () => {
    expect(formatSetSummary(null)).toBe('')
    expect(
      formatSetSummary(setOn('2026-07-22', { set: 1, weight: 0, reps: 0 })),
    ).toBe('')
  })

  it('formats compact chips', () => {
    expect(formatSetChip(setOn('2026-07-22', { set: 1 }))).toBe('60×10')
    expect(
      formatSetChip(setOn('2026-07-22', { set: 1, weight: 0, reps: 0 })),
    ).toBe('—')
  })
})

describe('describeRelativeDay', () => {
  it('describes recent days in words', () => {
    expect(describeRelativeDay('2026-07-24', TODAY)).toBe('Yesterday')
    expect(describeRelativeDay('2026-07-22', TODAY)).toBe('3 days ago')
    expect(describeRelativeDay('2026-07-25', TODAY)).toBe('Today')
  })

  it('falls back to a date once it is over a month old', () => {
    expect(describeRelativeDay('2026-05-04', TODAY)).not.toMatch(/days ago/)
  })

  it('is not thrown off by a DST boundary', () => {
    // 2026-03-08 is the US spring-forward date; that day is 23 hours long, so
    // naive ms division would report 6 days instead of 7.
    expect(describeRelativeDay('2026-03-05', '2026-03-12')).toBe('7 days ago')
  })
})
