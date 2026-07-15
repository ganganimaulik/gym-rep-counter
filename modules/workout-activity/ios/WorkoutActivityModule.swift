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

        let attributes = WorkoutAttributes(id: UUID().uuidString)
        let state = Self.parseContentState(data)

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

        let state = Self.parseContentState(data)

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

  @available(iOS 16.2, *)
  private static func parseContentState(_ data: [String: Any]) -> WorkoutAttributes.ContentState {
    return WorkoutAttributes.ContentState(
        exerciseName: data["exerciseName"] as? String ?? "",
        nextExerciseName: data["nextExerciseName"] as? String ?? "",
        currentSet: data["currentSet"] as? Int ?? 1,
        totalSets: data["totalSets"] as? Int ?? 1,
        reps: data["reps"] as? Int ?? 0,
        currentRep: data["currentRep"] as? Int ?? 0,
        phase: data["phase"] as? String ?? "",
        isResting: data["isResting"] as? Bool ?? false,
        isPaused: data["isPaused"] as? Bool ?? false,
        isRestComplete: data["isRestComplete"] as? Bool ?? false,
        restSeconds: data["restSeconds"] as? Int ?? 0,
        pausedRemainingSeconds: data["pausedRemainingSeconds"] as? Int ?? 0,
        restStartTimestamp: data["restStartTimestamp"] as? Double ?? (Date().timeIntervalSince1970 * 1000)
    )
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
