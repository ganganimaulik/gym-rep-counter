const generateId = () => {
    // Simple ID generator
    return Math.random().toString(36).substring(2, 11);
};

export const getDefaultWorkouts = () => {
    return [
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
  };