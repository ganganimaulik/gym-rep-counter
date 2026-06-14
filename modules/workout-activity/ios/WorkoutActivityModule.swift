import ExpoModulesCore
import ActivityKit
import workout_attributes

public class WorkoutActivityModule: Module {
  private var currentActivity: Any? = nil

  public func definition() -> ModuleDefinition {
    Name("WorkoutActivityModule")

    Function("startActivity") { (data: [String: Any]) in
      if #available(iOS 16.2, *) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        
        self.stopActivity()
        
        let exerciseName = data["exerciseName"] as? String ?? ""
        let nextExerciseName = data["nextExerciseName"] as? String ?? ""
        let currentSet = data["currentSet"] as? Int ?? 1
        let totalSets = data["totalSets"] as? Int ?? 1
        let reps = data["reps"] as? Int ?? 0
        let phase = data["phase"] as? String ?? ""
        let isResting = data["isResting"] as? Bool ?? false
        let restSeconds = data["restSeconds"] as? Int ?? 0
        let restStartTimestamp = data["restStartTimestamp"] as? Double ?? (Date().timeIntervalSince1970 * 1000)
        
        let attributes = WorkoutAttributes(id: UUID().uuidString)
        let state = WorkoutAttributes.ContentState(
            exerciseName: exerciseName,
            nextExerciseName: nextExerciseName,
            currentSet: currentSet,
            totalSets: totalSets,
            reps: reps,
            phase: phase,
            isResting: isResting,
            restSeconds: restSeconds,
            restStartTimestamp: restStartTimestamp
        )
        
        do {
            let activity = try Activity<WorkoutAttributes>.request(
                attributes: attributes,
                content: ActivityContent(state: state, staleDate: nil, relevanceScore: 1.0)
            )
            self.currentActivity = activity
            print("WorkoutActivityModule: Successfully started Live Activity! ID: \(activity.id)")
        } catch {
            print("WorkoutActivityModule: Failed to start Live Activity: \(error.localizedDescription)")
        }
      }
    }

    Function("updateActivity") { (data: [String: Any]) in
      if #available(iOS 16.2, *) {
        guard let activity = self.currentActivity as? Activity<WorkoutAttributes> else { return }
        
        let exerciseName = data["exerciseName"] as? String ?? ""
        let nextExerciseName = data["nextExerciseName"] as? String ?? ""
        let currentSet = data["currentSet"] as? Int ?? 1
        let totalSets = data["totalSets"] as? Int ?? 1
        let reps = data["reps"] as? Int ?? 0
        let phase = data["phase"] as? String ?? ""
        let isResting = data["isResting"] as? Bool ?? false
        let restSeconds = data["restSeconds"] as? Int ?? 0
        let restStartTimestamp = data["restStartTimestamp"] as? Double ?? (Date().timeIntervalSince1970 * 1000)
        
        let state = WorkoutAttributes.ContentState(
            exerciseName: exerciseName,
            nextExerciseName: nextExerciseName,
            currentSet: currentSet,
            totalSets: totalSets,
            reps: reps,
            phase: phase,
            isResting: isResting,
            restSeconds: restSeconds,
            restStartTimestamp: restStartTimestamp
        )
        
        Task {
            await activity.update(ActivityContent(state: state, staleDate: nil, relevanceScore: 1.0))
            print("WorkoutActivityModule: Successfully updated Live Activity! ID: \(activity.id)")
        }
      }
    }

    Function("stopActivity") { () in
      self.stopActivity()
    }
  }

  private func stopActivity() {
    if #available(iOS 16.2, *) {
      guard let activity = self.currentActivity as? Activity<WorkoutAttributes> else { return }
      Task {
        await activity.end(nil, dismissalPolicy: .immediate)
        self.currentActivity = nil
        print("WorkoutActivityModule: Successfully stopped Live Activity!")
      }
    }
  }
}
