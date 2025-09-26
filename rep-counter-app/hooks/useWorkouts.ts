import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const getDefaultWorkouts = (): Workout[] => [
  {
    id: generateId(),
    name: "Day 1 (Lower)",
    exercises: [
      { id: generateId(), name: "Leg Press", sets: 4, reps: 10 },
      { id: generateId(), name: "RDL", sets: 4, reps: 10 },
      { id: generateId(), name: "Leg Curl of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Calves of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Leg Extensions of Choice", sets: 3, reps: 15 },
    ],
  },
  {
    id: generateId(),
    name: "Day 2 (Upper)",
    exercises: [
      { id: generateId(), name: "Horizontal Press of Choice", sets: 4, reps: 10 },
      { id: generateId(), name: "Horizontal Row of Choice", sets: 4, reps: 12 },
      { id: generateId(), name: "Vertical Press of Choice", sets: 4, reps: 10 },
      { id: generateId(), name: "Vertical Pull of Choice", sets: 4, reps: 12 },
      { id: generateId(), name: "Triceps Extension of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Biceps of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Lateral Raise of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Rear Delt of Choice", sets: 3, reps: 15 },
    ],
  },
  {
    id: generateId(),
    name: "Day 3 (Lower)",
    exercises: [
      { id: generateId(), name: "Squat Type Movement of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Hip Hinge Type Movement of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Leg Curl of Choice", sets: 2, reps: 20 },
      { id: generateId(), name: "Calves of Choice", sets: 2, reps: 20 },
      { id: generateId(), name: "Leg Extensions of Choice", sets: 2, reps: 20 },
    ],
  },
  {
    id: generateId(),
    name: "Day 4 (Upper)",
    exercises: [
      { id: generateId(), name: "Horizontal Press of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Horizontal Row of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Vertical Press of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Vertical Pull of Choice", sets: 3, reps: 15 },
      { id: generateId(), name: "Triceps Extension of Choice", sets: 2, reps: 20 },
      { id: generateId(), name: "Biceps of Choice", sets: 2, reps: 20 },
      { id: generateId(), name: "Lateral Raise of Choice", sets: 2, reps: 20 },
      { id: generateId(), name: "Rear Delt of Choice", sets: 2, reps: 20 },
    ],
  },
];

export const useWorkouts = () => {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [loading, setLoading] = useState(true);

    const saveAndSetWorkouts = async (newWorkouts: Workout[]) => {
        try {
            await AsyncStorage.setItem('workouts', JSON.stringify(newWorkouts));
            setWorkouts(newWorkouts);
        } catch (e) {
            console.error("Failed to save workouts.", e);
        }
    };

    useEffect(() => {
        const loadWorkouts = async () => {
            try {
                const savedWorkouts = await AsyncStorage.getItem('workouts');
                if (savedWorkouts) {
                    setWorkouts(JSON.parse(savedWorkouts));
                } else {
                    const defaultWorkouts = getDefaultWorkouts();
                    await saveAndSetWorkouts(defaultWorkouts);
                }
            } catch (e) {
                console.error("Failed to load workouts.", e);
                setWorkouts(getDefaultWorkouts()); // Fallback
            } finally {
                setLoading(false);
            }
        };

        loadWorkouts();
    }, []);

    const addWorkout = async (name: string) => {
        const newWorkout: Workout = { id: generateId(), name, exercises: [] };
        const newWorkouts = [...workouts, newWorkout];
        await saveAndSetWorkouts(newWorkouts);
    };

    const deleteWorkout = async (id: string) => {
        const newWorkouts = workouts.filter(w => w.id !== id);
        await saveAndSetWorkouts(newWorkouts);
    };

    const addExercise = async (workoutId: string, exerciseData: Omit<Exercise, 'id'>) => {
        const newWorkouts = workouts.map(w => {
            if (w.id === workoutId) {
                return { ...w, exercises: [...w.exercises, { ...exerciseData, id: generateId() }] };
            }
            return w;
        });
        await saveAndSetWorkouts(newWorkouts);
    };

    const deleteExercise = async (workoutId: string, exerciseId: string) => {
        const newWorkouts = workouts.map(w => {
            if (w.id === workoutId) {
                return { ...w, exercises: w.exercises.filter(ex => ex.id !== exerciseId) };
            }
            return w;
        });
        await saveAndSetWorkouts(newWorkouts);
    };

    return { workouts, loading, addWorkout, deleteWorkout, addExercise, deleteExercise };
};