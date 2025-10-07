import { Timestamp } from 'firebase/firestore';

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  reps: number;
  weight: number;
  date: Timestamp;
}