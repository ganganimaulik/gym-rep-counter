export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
}

export interface Workout {
  id: string;
  name: string;
  exercises: Exercise[];
}