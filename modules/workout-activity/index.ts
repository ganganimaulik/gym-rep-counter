import { requireNativeModule } from 'expo-modules-core'

let WorkoutActivityModule: any = null
try {
  WorkoutActivityModule = requireNativeModule('WorkoutActivityModule')
} catch (error) {
  console.warn(
    'WorkoutActivityModule is not available in this environment:',
    error,
  )
}

export interface WorkoutActivityState {
  exerciseName: string
  nextExerciseName: string
  currentSet: number
  totalSets: number
  reps: number
  phase: string
  isResting: boolean
  restSeconds: number
  restStartTimestamp: number
}

export function startActivity(state: WorkoutActivityState) {
  if (!WorkoutActivityModule) {
    console.warn('WorkoutActivityModule is not available')
    return
  }
  try {
    return WorkoutActivityModule.startActivity(state)
  } catch (error) {
    console.error('Failed to call startActivity:', error)
  }
}

export function updateActivity(state: WorkoutActivityState) {
  if (!WorkoutActivityModule) {
    console.warn('WorkoutActivityModule is not available')
    return
  }
  try {
    return WorkoutActivityModule.updateActivity(state)
  } catch (error) {
    console.error('Failed to call updateActivity:', error)
  }
}

export function stopActivity() {
  if (!WorkoutActivityModule) {
    console.warn('WorkoutActivityModule is not available')
    return
  }
  try {
    return WorkoutActivityModule.stopActivity()
  } catch (error) {
    console.error('Failed to call stopActivity:', error)
  }
}
