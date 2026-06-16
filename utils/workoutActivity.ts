import { Platform } from 'react-native'
import * as WorkoutActivity from '../modules/workout-activity'

export type WorkoutActivityState = WorkoutActivity.WorkoutActivityState

export function startWorkoutActivity(state: WorkoutActivityState) {
  if (Platform.OS === 'web') return
  try {
    WorkoutActivity.startActivity(state)
  } catch (error) {
    console.error('Failed to start workout activity:', error)
  }
}

export function updateWorkoutActivity(state: WorkoutActivityState) {
  if (Platform.OS === 'web') return
  try {
    WorkoutActivity.updateActivity(state)
  } catch (error) {
    console.error('Failed to update workout activity:', error)
  }
}

export function stopWorkoutActivity() {
  if (Platform.OS === 'web') return
  try {
    WorkoutActivity.stopActivity()
  } catch (error) {
    console.error('Failed to stop workout activity:', error)
  }
}
