import {
  calculatePRs,
  calculateStreak,
  calculateVolume,
  calculateTrends,
  getUniqueExercises,
} from '../analyticsUtils'
import { Timestamp } from 'firebase/firestore'
import type { WorkoutSet, WeightUnit } from '../../declarations'

// Mock Firestore Timestamp
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

// Helper to create mock WorkoutSet
const createMockSet = (
  exerciseId: string,
  exerciseName: string,
  weight: number,
  reps: number,
  date: Date,
  weightUnit?: WeightUnit,
): WorkoutSet => ({
  id: `${Date.now()}-${Math.random()}`,
  workoutId: 'workout-1',
  exerciseId,
  exerciseName,
  weight,
  reps,
  set: 1,
  ...(weightUnit ? { weightUnit } : {}),

  date: new Timestamp(Math.floor(date.getTime() / 1000), 0) as any,
})

describe('analyticsUtils', () => {
  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-05')) // Friday
  })

  afterAll(() => {
    jest.useRealTimers()
  })
  describe('calculatePRs', () => {
    it('should return empty array for empty history', () => {
      const result = calculatePRs([])
      expect(result).toEqual([])
    })

    it('should find max weight per exercise', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench Press', 80, 10, new Date('2024-01-01')),
        createMockSet('ex1', 'Bench Press', 85, 8, new Date('2024-01-02')),
        createMockSet('ex1', 'Bench Press', 75, 12, new Date('2024-01-03')),
        createMockSet('ex2', 'Squat', 100, 5, new Date('2024-01-01')),
        createMockSet('ex2', 'Squat', 110, 3, new Date('2024-01-02')),
      ]

      const result = calculatePRs(history)

      expect(result).toHaveLength(2)
      expect(result[0].maxWeight).toBe(110) // Squat PR
      expect(result[0].exerciseName).toBe('Squat')
      expect(result[1].maxWeight).toBe(85) // Bench PR
      expect(result[1].exerciseName).toBe('Bench Press')
    })

    it('should filter by exerciseId when provided', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench Press', 80, 10, new Date('2024-01-01')),
        createMockSet('ex2', 'Squat', 100, 5, new Date('2024-01-01')),
      ]

      const result = calculatePRs(history, 'ex1')

      expect(result).toHaveLength(1)
      expect(result[0].exerciseName).toBe('Bench Press')
    })

    it('should track separate PRs per weight unit for the same exercise', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Leg Press', 60, 10, new Date('2024-01-01'), 'kg'),
        createMockSet('ex1', 'Leg Press', 65, 8, new Date('2024-01-02'), 'kg'),
        createMockSet(
          'ex1',
          'Leg Press',
          10,
          10,
          new Date('2024-01-03'),
          'plates',
        ),
        createMockSet(
          'ex1',
          'Leg Press',
          12,
          8,
          new Date('2024-01-04'),
          'plates',
        ),
      ]

      const result = calculatePRs(history)

      expect(result).toHaveLength(2)
      // Kg PR listed first, plates PR after — never compared to each other
      expect(result[0].weightUnit).toBe('kg')
      expect(result[0].maxWeight).toBe(65)
      expect(result[1].weightUnit).toBe('plates')
      expect(result[1].maxWeight).toBe(12)
    })

    it('should treat sets without a unit as kg', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench Press', 80, 10, new Date('2024-01-01')),
        createMockSet(
          'ex1',
          'Bench Press',
          85,
          8,
          new Date('2024-01-02'),
          'kg',
        ),
      ]

      const result = calculatePRs(history)

      // Legacy unit-less set and explicit kg set share a single kg PR
      expect(result).toHaveLength(1)
      expect(result[0].weightUnit).toBe('kg')
      expect(result[0].maxWeight).toBe(85)
    })

    it('should not let a numerically larger plates weight beat a kg PR', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Row', 40, 10, new Date('2024-01-01'), 'kg'),
        createMockSet('ex1', 'Row', 55, 10, new Date('2024-01-02'), 'plates'),
      ]

      const result = calculatePRs(history)

      expect(result).toHaveLength(2)
      const kgPr = result.find((pr) => pr.weightUnit === 'kg')
      const platesPr = result.find((pr) => pr.weightUnit === 'plates')
      expect(kgPr?.maxWeight).toBe(40)
      expect(platesPr?.maxWeight).toBe(55)
    })
  })

  describe('calculateStreak', () => {
    it('should return zero streak for empty history', () => {
      const result = calculateStreak([])
      expect(result.currentStreak).toBe(0)
      expect(result.longestStreak).toBe(0)
      expect(result.lastWorkoutDate).toBeNull()
    })

    it('should count workout days in current week', () => {
      const now = new Date()
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 80, 10, now),
        createMockSet('ex1', 'Bench', 80, 10, now), // Same day
      ]

      const result = calculateStreak(history, 5)

      expect(result.currentWeekWorkouts).toBe(1)
    })

    it('should track longest streak separately from current', () => {
      // History with qualifying weeks then a gap
      const now = new Date()
      const history: WorkoutSet[] = []

      // Add 3 workouts this week
      for (let i = 0; i < 3; i++) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        history.push(createMockSet('ex1', 'Bench', 80, 10, d))
      }

      const result = calculateStreak(history, 5)

      expect(result.lastWorkoutDate).not.toBeNull()
    })

    it('should track multi-week consecutive streak where current and longest both increase', () => {
      const now = new Date()
      const history: WorkoutSet[] = []

      // 3 consecutive weeks, 5 workouts each
      for (let w = 0; w < 3; w++) {
        for (let d = 0; d < 5; d++) {
          const date = new Date(now)
          date.setDate(date.getDate() - (w * 7 + d))
          history.push(createMockSet('ex1', 'Bench', 80, 10, date))
        }
      }

      const result = calculateStreak(history, 5)
      expect(result.currentStreak).toBe(3)
      expect(result.longestStreak).toBe(3)
    })

    it('should reset current streak but preserve longest streak when broken by gap week', () => {
      const now = new Date()
      const history: WorkoutSet[] = []

      // Longest streak: 4 weeks ago to 2 weeks ago (3 weeks)
      for (let w = 2; w < 5; w++) {
        for (let d = 0; d < 5; d++) {
          const date = new Date(now)
          date.setDate(date.getDate() - (w * 7 + d))
          history.push(createMockSet('ex1', 'Bench', 80, 10, date))
        }
      }

      // Current week: 5 workouts
      for (let d = 0; d < 5; d++) {
        const date = new Date(now)
        date.setDate(date.getDate() - d)
        history.push(createMockSet('ex1', 'Bench', 80, 10, date))
      }

      const result = calculateStreak(history, 5)
      expect(result.currentStreak).toBe(1)
      expect(result.longestStreak).toBe(3)
    })

    it('should break streak if a week has fewer than minDaysPerWeek workouts', () => {
      const now = new Date()
      const history: WorkoutSet[] = []

      // Week 3: 5 workouts
      for (let d = 0; d < 5; d++) {
        const date = new Date(now)
        date.setDate(date.getDate() - (14 + d))
        history.push(createMockSet('ex1', 'Bench', 80, 10, date))
      }

      // Week 2: 3 workouts (non-qualifying)
      for (let d = 0; d < 3; d++) {
        const date = new Date(now)
        date.setDate(date.getDate() - (7 + d))
        history.push(createMockSet('ex1', 'Bench', 80, 10, date))
      }

      // Week 1: 5 workouts
      for (let d = 0; d < 5; d++) {
        const date = new Date(now)
        date.setDate(date.getDate() - d)
        history.push(createMockSet('ex1', 'Bench', 80, 10, date))
      }

      const result = calculateStreak(history, 5)
      expect(result.currentStreak).toBe(1)
      expect(result.longestStreak).toBe(1)
    })

    it('should count as current streak if last week was qualifying but current week is empty', () => {
      const now = new Date()
      const history: WorkoutSet[] = []

      // Last week has 5 workouts
      for (let d = 0; d < 5; d++) {
        const date = new Date(now)
        date.setDate(date.getDate() - (7 + d))
        history.push(createMockSet('ex1', 'Bench', 80, 10, date))
      }

      const result = calculateStreak(history, 5)
      expect(result.currentStreak).toBe(1)
    })

    it('should handle minDaysPerWeek variations (default vs custom)', () => {
      const now = new Date()
      const history: WorkoutSet[] = []

      // Week 2 and Week 1 each have 3 workouts
      for (let w = 0; w < 2; w++) {
        for (let d = 0; d < 3; d++) {
          const date = new Date(now)
          date.setDate(date.getDate() - (w * 7 + d))
          history.push(createMockSet('ex1', 'Bench', 80, 10, date))
        }
      }

      const result5 = calculateStreak(history, 5)
      expect(result5.currentStreak).toBe(1)

      const result3 = calculateStreak(history, 3)
      expect(result3.currentStreak).toBe(2)
    })

    it('should return currentStreak = 0 for very old data only', () => {
      const now = new Date()
      const history: WorkoutSet[] = []

      // 10 weeks ago: 5 workouts
      for (let d = 0; d < 5; d++) {
        const date = new Date(now)
        date.setDate(date.getDate() - (70 + d))
        history.push(createMockSet('ex1', 'Bench', 80, 10, date))
      }

      const result = calculateStreak(history, 5)
      expect(result.currentStreak).toBe(0)
      expect(result.longestStreak).toBe(1)
    })
  })

  describe('calculateVolume', () => {
    it('should return empty array for empty history', () => {
      const result = calculateVolume([], 'week')
      expect(result).toEqual([])
    })

    it('should aggregate volume by week', () => {
      const now = new Date()
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 80, 10, now), // 800 volume
        createMockSet('ex1', 'Bench', 60, 15, now), // 900 volume
      ]

      const result = calculateVolume(history, 'week', 4)

      expect(result).toHaveLength(4)
      // Most recent week should have the volume (unit-less sets count as kg)
      const latestWeek = result[result.length - 1]
      expect(latestWeek.kgVolume).toBe(1700)
      expect(latestWeek.platesVolume).toBe(0)
    })

    it('should aggregate volume by month', () => {
      const now = new Date()
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 100, 10, now), // 1000 volume
      ]

      const result = calculateVolume(history, 'month', 3)

      expect(result).toHaveLength(3)
      const latestMonth = result[result.length - 1]
      expect(latestMonth.kgVolume).toBe(1000)
      expect(latestMonth.platesVolume).toBe(0)
    })

    it('should keep kg and plates volume separate', () => {
      const now = new Date()
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 80, 10, now, 'kg'), // 800 kg volume
        createMockSet('ex2', 'Leg Press', 10, 10, now, 'plates'), // 100 plates volume
        createMockSet('ex3', 'Squat', 100, 5, now), // 500 kg volume (legacy, no unit)
      ]

      const result = calculateVolume(history, 'week', 4)

      const latestWeek = result[result.length - 1]
      expect(latestWeek.kgVolume).toBe(1300)
      expect(latestWeek.platesVolume).toBe(100)
    })
  })

  describe('calculateTrends', () => {
    it('should return empty array for empty history', () => {
      const result = calculateTrends([], 'ex1')
      expect(result).toEqual([])
    })

    it('should return empty array if exercise not found', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 80, 10, new Date('2024-01-01')),
      ]
      const result = calculateTrends(history, 'ex2')
      expect(result).toEqual([])
    })

    it('should calculate average weight and reps per day', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 80, 10, new Date('2024-01-01')),
        createMockSet('ex1', 'Bench', 100, 8, new Date('2024-01-01')), // Same day
        createMockSet('ex1', 'Bench', 90, 12, new Date('2024-01-02')),
      ]

      const result = calculateTrends(history, 'ex1')

      // Unit-less sets are treated as a single kg series
      expect(result).toHaveLength(1)
      expect(result[0].weightUnit).toBe('kg')
      const trends = result[0].data
      expect(trends).toHaveLength(2)
      // First day average: (80 + 100) / 2 = 90
      expect(trends[0].avgWeight).toBe(90)
      expect(trends[0].avgReps).toBe(9)
      expect(trends[0].setCount).toBe(2)
      // Second day
      expect(trends[1].avgWeight).toBe(90)
      expect(trends[1].avgReps).toBe(12)
    })

    it('should sort trends by date ascending', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 80, 10, new Date('2024-01-03')),
        createMockSet('ex1', 'Bench', 70, 10, new Date('2024-01-01')),
        createMockSet('ex1', 'Bench', 75, 10, new Date('2024-01-02')),
      ]

      const result = calculateTrends(history, 'ex1')

      const trends = result[0].data
      expect(trends[0].avgWeight).toBe(70) // Jan 1
      expect(trends[1].avgWeight).toBe(75) // Jan 2
      expect(trends[2].avgWeight).toBe(80) // Jan 3
    })

    it('should split kg and plates sets into separate series', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Leg Press', 60, 10, new Date('2024-01-01'), 'kg'),
        createMockSet(
          'ex1',
          'Leg Press',
          10,
          10,
          new Date('2024-01-01'),
          'plates',
        ), // Same day, different unit
        createMockSet(
          'ex1',
          'Leg Press',
          12,
          8,
          new Date('2024-01-02'),
          'plates',
        ),
      ]

      const result = calculateTrends(history, 'ex1')

      expect(result).toHaveLength(2)
      // Kg series first
      expect(result[0].weightUnit).toBe('kg')
      expect(result[0].data).toHaveLength(1)
      // Kg average unaffected by the same-day plates set
      expect(result[0].data[0].avgWeight).toBe(60)
      expect(result[0].data[0].setCount).toBe(1)
      // Plates series second
      expect(result[1].weightUnit).toBe('plates')
      expect(result[1].data).toHaveLength(2)
      expect(result[1].data[0].avgWeight).toBe(10)
      expect(result[1].data[1].avgWeight).toBe(12)
    })
  })

  describe('getUniqueExercises', () => {
    it('should return empty array for empty history', () => {
      const result = getUniqueExercises([])
      expect(result).toEqual([])
    })

    it('should return unique exercises', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench Press', 80, 10, new Date()),
        createMockSet('ex1', 'Bench Press', 85, 8, new Date()),
        createMockSet('ex2', 'Squat', 100, 5, new Date()),
      ]

      const result = getUniqueExercises(history)

      expect(result).toHaveLength(2)
      expect(result).toContainEqual({ id: 'ex1', name: 'Bench Press' })
      expect(result).toContainEqual({ id: 'ex2', name: 'Squat' })
    })
  })
})
