import { getDefaultWorkouts } from '../defaultWorkouts'
import { Workout } from '../../hooks/useData'

describe('getDefaultWorkouts', () => {
  it('should return an array of workouts with the correct structure', () => {
    const workouts = getDefaultWorkouts()

    expect(Array.isArray(workouts)).toBe(true)
    expect(workouts.length).toBeGreaterThan(0)

    workouts.forEach((workout: Workout) => {
      expect(workout).toHaveProperty('id')
      expect(typeof workout.id).toBe('string')
      expect(workout).toHaveProperty('name')
      expect(typeof workout.name).toBe('string')
      expect(workout).toHaveProperty('exercises')
      expect(Array.isArray(workout.exercises)).toBe(true)

      workout.exercises.forEach(exercise => {
        expect(exercise).toHaveProperty('id')
        expect(typeof exercise.id).toBe('string')
        expect(exercise).toHaveProperty('name')
        expect(typeof exercise.name).toBe('string')
        expect(exercise).toHaveProperty('sets')
        expect(typeof exercise.sets).toBe('number')
        expect(exercise).toHaveProperty('reps')
        expect(typeof exercise.reps).toBe('number')
      })
    })
  })
})