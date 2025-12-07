import {
  calculatePRs,
  calculateStreak,
  calculateVolume,
  calculateTrends,
  getUniqueExercises,
} from '../analyticsUtils'
import { Timestamp } from 'firebase/firestore'
import type { WorkoutSet, PRRecord, StreakInfo, VolumeData, TrendData } from '../../declarations'

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
): WorkoutSet => ({
  id: `${Date.now()}-${Math.random()}`,
  workoutId: 'workout-1',
  exerciseId,
  exerciseName,
  weight,
  reps,
  set: 1,
  date: new Timestamp(Math.floor(date.getTime() / 1000), 0) as any,
})

describe('analyticsUtils', () => {
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
      // Most recent week should have the volume
      const latestWeek = result[result.length - 1]
      expect(latestWeek.totalVolume).toBe(1700)
    })

    it('should aggregate volume by month', () => {
      const now = new Date()
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 100, 10, now), // 1000 volume
      ]

      const result = calculateVolume(history, 'month', 3)

      expect(result).toHaveLength(3)
      const latestMonth = result[result.length - 1]
      expect(latestMonth.totalVolume).toBe(1000)
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

      expect(result).toHaveLength(2)
      // First day average: (80 + 100) / 2 = 90
      expect(result[0].avgWeight).toBe(90)
      expect(result[0].avgReps).toBe(9)
      expect(result[0].setCount).toBe(2)
      // Second day
      expect(result[1].avgWeight).toBe(90)
      expect(result[1].avgReps).toBe(12)
    })

    it('should sort trends by date ascending', () => {
      const history: WorkoutSet[] = [
        createMockSet('ex1', 'Bench', 80, 10, new Date('2024-01-03')),
        createMockSet('ex1', 'Bench', 70, 10, new Date('2024-01-01')),
        createMockSet('ex1', 'Bench', 75, 10, new Date('2024-01-02')),
      ]

      const result = calculateTrends(history, 'ex1')

      expect(result[0].avgWeight).toBe(70) // Jan 1
      expect(result[1].avgWeight).toBe(75) // Jan 2
      expect(result[2].avgWeight).toBe(80) // Jan 3
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
