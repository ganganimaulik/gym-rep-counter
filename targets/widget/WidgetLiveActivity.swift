import ActivityKit
import WidgetKit
import SwiftUI
import workout_attributes

struct WidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            // Lock screen/banner UI
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.isResting ? "Resting" : context.state.exerciseName)
                            .font(.system(.title3, design: .rounded))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        
                        if context.state.isResting {
                            Text("Next: \(context.state.nextExerciseName.isEmpty ? "None" : context.state.nextExerciseName)")
                                .font(.system(.subheadline, design: .rounded))
                                .foregroundColor(.gray)
                        } else {
                            Text("Set \(context.state.currentSet) of \(context.state.totalSets) • \(context.state.reps) Reps")
                                .font(.system(.subheadline, design: .rounded))
                                .foregroundColor(.gray)
                        }
                    }
                    
                    Spacer()
                    
                    if context.state.isResting {
                        let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                        let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                        
                        Text(timerInterval: startDate...endDate, countsDown: true)
                            .font(.system(.title, design: .monospaced))
                            .fontWeight(.semibold)
                            .foregroundColor(Color(red: 249/255, green: 115/255, blue: 22/255)) // Orange-500
                    } else {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("Set")
                                .font(.system(.caption, design: .rounded))
                                .foregroundColor(.gray)
                            Text("\(context.state.currentSet)/\(context.state.totalSets)")
                                .font(.system(.title2, design: .rounded))
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                        }
                    }
                }
                
                if context.state.isResting {
                    let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                    let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                    
                    ProgressView(timerInterval: startDate...endDate, countsDown: true)
                        .tint(Color(red: 249/255, green: 115/255, blue: 22/255))
                        .background(Color.zinc900)
                }
            }
            .padding()
            .activityBackgroundTint(Color(red: 9/255, green: 9/255, blue: 11/255)) // Zinc-950
            .activitySystemActionForegroundColor(Color.white)
            
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Region
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.isResting ? "Resting" : context.state.exerciseName)
                            .font(.system(.headline, design: .rounded))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        if !context.state.isResting {
                            Text("Set \(context.state.currentSet) of \(context.state.totalSets)")
                                .font(.system(.caption, design: .rounded))
                                .foregroundColor(.gray)
                        } else {
                            Text("Next: \(context.state.nextExerciseName.isEmpty ? "None" : context.state.nextExerciseName)")
                                .font(.system(.caption, design: .rounded))
                                .foregroundColor(.gray)
                        }
                    }
                    .padding(.leading, 8)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        if context.state.isResting {
                            let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                            let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                            Text(timerInterval: startDate...endDate, countsDown: true)
                                .font(.system(.body, design: .monospaced))
                                .fontWeight(.bold)
                                .foregroundColor(Color(red: 249/255, green: 115/255, blue: 22/255))
                        } else {
                            Text("\(context.state.reps) Reps")
                                .font(.system(.body, design: .rounded))
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                        }
                    }
                    .padding(.trailing, 8)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        if context.state.isResting {
                            let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                            let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                            ProgressView(timerInterval: startDate...endDate, countsDown: true)
                                .tint(Color(red: 249/255, green: 115/255, blue: 22/255))
                                .padding(.horizontal, 8)
                        } else {
                            Text("Keep it up!")
                                .font(.system(.caption, design: .rounded))
                                .italic()
                                .foregroundColor(.gray)
                                .padding(.leading, 8)
                        }
                    }
                }
            } compactLeading: {
                if context.state.isResting {
                    Image(systemName: "timer")
                        .foregroundColor(Color(red: 249/255, green: 115/255, blue: 22/255))
                } else {
                    Text("S\(context.state.currentSet)")
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                }
            } compactTrailing: {
                if context.state.isResting {
                    let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                    let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                    Text(timerInterval: startDate...endDate, countsDown: true)
                        .font(.system(.body, design: .monospaced))
                        .fontWeight(.bold)
                        .foregroundColor(Color(red: 249/255, green: 115/255, blue: 22/255))
                } else {
                    Text("\(context.state.reps)R")
                        .foregroundColor(.white)
                }
            } minimal: {
                if context.state.isResting {
                    Image(systemName: "timer")
                        .foregroundColor(Color(red: 249/255, green: 115/255, blue: 22/255))
                } else {
                    Text("\(context.state.currentSet)")
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                }
            }
            .widgetURL(URL(string: "repcounterapp://workout"))
            .keylineTint(Color.zinc800)
        }
    }
}

extension Color {
    fileprivate static let zinc800 = Color(red: 39/255, green: 39/255, blue: 42/255)
    fileprivate static let zinc900 = Color(red: 24/255, green: 24/255, blue: 27/255)
}
