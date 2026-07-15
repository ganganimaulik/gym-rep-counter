import ActivityKit
import Foundation

public struct WorkoutAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var exerciseName: String
        public var nextExerciseName: String
        public var currentSet: Int
        public var totalSets: Int
        public var reps: Int
        public var currentRep: Int
        public var phase: String
        public var isResting: Bool
        public var isPaused: Bool
        public var isRestComplete: Bool
        public var restSeconds: Int
        public var pausedRemainingSeconds: Int
        public var restStartTimestamp: Double // Unix timestamp in ms

        public init(
            exerciseName: String,
            nextExerciseName: String,
            currentSet: Int,
            totalSets: Int,
            reps: Int,
            currentRep: Int,
            phase: String,
            isResting: Bool,
            isPaused: Bool,
            isRestComplete: Bool,
            restSeconds: Int,
            pausedRemainingSeconds: Int,
            restStartTimestamp: Double
        ) {
            self.exerciseName = exerciseName
            self.nextExerciseName = nextExerciseName
            self.currentSet = currentSet
            self.totalSets = totalSets
            self.reps = reps
            self.currentRep = currentRep
            self.phase = phase
            self.isResting = isResting
            self.isPaused = isPaused
            self.isRestComplete = isRestComplete
            self.restSeconds = restSeconds
            self.pausedRemainingSeconds = pausedRemainingSeconds
            self.restStartTimestamp = restStartTimestamp
        }
    }
    public var id: String

    public init(id: String) {
        self.id = id
    }
}
