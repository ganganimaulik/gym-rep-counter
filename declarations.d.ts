import { Timestamp } from 'firebase/firestore';

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  reps: number;
  weight: number;
  set: number;
  startTime?: Timestamp; // When the set started (optional for backward compat)
  date: Timestamp; // When the set ended/was completed
}