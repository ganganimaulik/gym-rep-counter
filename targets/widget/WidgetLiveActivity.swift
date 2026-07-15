import ActivityKit
import WidgetKit
import SwiftUI
import workout_attributes

private extension WorkoutAttributes.ContentState {
    // Rest completion only makes sense while resting; guard against stale flags.
    var isRestDone: Bool { isResting && isRestComplete }

    var accentColor: Color {
        if isRestDone { return .green }
        return isResting ? .orange : .blue
    }

    var iconName: String {
        if isRestDone { return "checkmark" }
        return isResting ? "timer" : "dumbbell.fill"
    }

    var restInterval: ClosedRange<Date> {
        let start = Date(timeIntervalSince1970: restStartTimestamp / 1000.0)
        return start...start.addingTimeInterval(Double(max(1, restSeconds)))
    }

    var pausedTimeText: String {
        String(format: "%d:%02d", pausedRemainingSeconds / 60, pausedRemainingSeconds % 60)
    }

    var pausedProgress: Double {
        guard restSeconds > 0 else { return 0 }
        return min(1, max(0, 1 - Double(pausedRemainingSeconds) / Double(restSeconds)))
    }

    var restSubtitle: String {
        var text = "Next: Set \(currentSet) of \(totalSets)"
        if isPaused && !isRestDone {
            text = "Paused • " + text
        }
        return text
    }

    var exerciseSubtitle: String {
        if isPaused {
            return "Paused • Set \(currentSet)/\(totalSets)"
        }
        return "Set \(currentSet)/\(totalSets) • Rep \(currentRep) of \(reps)"
    }
}

// Countdown that freezes while paused and flips to a "GO!" call-to-action
// once the rest target is reached.
private struct RestTimerText: View {
    let state: WorkoutAttributes.ContentState
    var font: Font = .system(.title2, design: .monospaced)

    var body: some View {
        if state.isRestDone {
            Text("GO!")
                .font(.system(.title2, design: .rounded))
                .fontWeight(.heavy)
                .foregroundColor(.green)
        } else if state.isPaused {
            Text(state.pausedTimeText)
                .font(font)
                .fontWeight(.bold)
                .foregroundColor(.orange.opacity(0.6))
        } else {
            Text(timerInterval: state.restInterval, countsDown: true)
                .font(font)
                .fontWeight(.bold)
                .foregroundColor(.orange)
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct RestProgressBar: View {
    let state: WorkoutAttributes.ContentState

    var body: some View {
        Group {
            if state.isRestDone {
                ProgressView(value: 1)
                    .tint(.green)
            } else if state.isPaused {
                ProgressView(value: state.pausedProgress)
                    .tint(.orange.opacity(0.6))
            } else {
                ProgressView(timerInterval: state.restInterval, countsDown: true)
                    .tint(.orange)
            }
        }
        .background(Color.zinc800)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct WidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            // Lock screen/banner UI
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 16) {
                    // Left Icon
                    ZStack {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(context.state.accentColor.opacity(0.15))
                            .frame(width: 52, height: 52)

                        Image(systemName: context.state.iconName)
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundColor(context.state.accentColor)
                    }

                    // Center Content
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.isRestDone ? "Rest Complete" : context.state.exerciseName)
                            .font(.system(.headline, design: .rounded))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .lineLimit(1)

                        if context.state.isResting {
                            Text(context.state.isRestDone
                                ? "\(context.state.exerciseName) • Set \(context.state.currentSet) of \(context.state.totalSets)"
                                : context.state.restSubtitle)
                                .font(.system(.subheadline, design: .rounded))
                                .foregroundColor(.gray)
                                .lineLimit(1)

                            if !context.state.nextExerciseName.isEmpty {
                                Text("Then: \(context.state.nextExerciseName)")
                                    .font(.system(.caption, design: .rounded))
                                    .foregroundColor(.gray.opacity(0.8))
                                    .lineLimit(1)
                            }
                        } else {
                            Text(context.state.exerciseSubtitle)
                                .font(.system(.subheadline, design: .rounded))
                                .foregroundColor(.gray)
                                .lineLimit(1)
                        }
                    }

                    Spacer(minLength: 0)

                    // Trailing Content
                    if context.state.isResting {
                        RestTimerText(state: context.state)
                    } else {
                        ZStack {
                            Circle()
                                .stroke(Color.blue.opacity(0.3), lineWidth: 4)
                                .frame(width: 46, height: 46)

                            Circle()
                                .trim(from: 0, to: CGFloat(context.state.currentRep) / CGFloat(max(1, context.state.reps)))
                                .stroke(Color.blue, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                                .frame(width: 46, height: 46)
                                .rotationEffect(.degrees(-90))

                            Text("\(context.state.currentRep)")
                                .font(.system(.title3, design: .rounded))
                                .fontWeight(.bold)
                                .foregroundColor(.blue)
                        }
                    }
                }

                if context.state.isResting {
                    RestProgressBar(state: context.state)
                        .padding(.top, 4)
                }
            }
            .padding(16)
            .activityBackgroundTint(Color(red: 24/255, green: 24/255, blue: 27/255)) // zinc-900
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Region
                DynamicIslandExpandedRegion(.leading) {
                    ZStack {
                        Circle()
                            .fill(context.state.accentColor.opacity(0.15))
                            .frame(width: 36, height: 36)
                        Image(systemName: context.state.iconName)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(context.state.accentColor)
                    }
                    .padding(.leading, 4)
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.isRestDone ? "Rest Complete" : context.state.exerciseName)
                        .font(.system(.headline, design: .rounded))
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isResting {
                        RestTimerText(state: context.state, font: .system(.title3, design: .monospaced))
                            .frame(width: 60, alignment: .trailing)
                            .padding(.trailing, 4)
                    } else {
                        VStack(alignment: .trailing, spacing: 0) {
                            Text("REP")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundColor(.blue)
                            Text("\(context.state.currentRep)/\(context.state.reps)")
                                .font(.system(.title3, design: .rounded))
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                        }
                        .padding(.trailing, 8)
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        if context.state.isResting {
                            HStack(spacing: 6) {
                                Text(context.state.restSubtitle)
                                if !context.state.nextExerciseName.isEmpty {
                                    Text("•")
                                    Text("Then: \(context.state.nextExerciseName)")
                                }
                            }
                            .font(.system(.subheadline, design: .rounded))
                            .foregroundColor(.gray)
                            .lineLimit(1)
                            .padding(.horizontal, 8)

                            RestProgressBar(state: context.state)
                                .padding(.horizontal, 8)
                                .padding(.bottom, 8)
                        } else {
                            HStack {
                                HStack(spacing: 4) {
                                    Image(systemName: "number.circle.fill")
                                        .foregroundColor(.gray)
                                    Text("Set \(context.state.currentSet) of \(context.state.totalSets)")
                                        .foregroundColor(.white)
                                }

                                Spacer()

                                HStack(spacing: 4) {
                                    Image(systemName: "arrow.2.squarepath")
                                        .foregroundColor(.gray)
                                    Text(context.state.isPaused
                                        ? "Paused"
                                        : "Rep \(context.state.currentRep) of \(context.state.reps)")
                                        .foregroundColor(.white)
                                }
                            }
                            .font(.system(.subheadline, design: .rounded))
                            .padding(.horizontal, 12)
                            .padding(.top, 8)
                            .padding(.bottom, 8)
                        }
                    }
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: context.state.iconName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(context.state.accentColor)

                    if !context.state.isResting {
                        Text("S\(context.state.currentSet)")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                }
                .padding(.leading, 4)
            } compactTrailing: {
                if context.state.isRestDone {
                    Text("GO!")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .foregroundColor(.green)
                        .padding(.trailing, 4)
                } else if context.state.isResting {
                    if context.state.isPaused {
                        Text(context.state.pausedTimeText)
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(.orange.opacity(0.6))
                            .padding(.trailing, 4)
                    } else {
                        Text(timerInterval: context.state.restInterval, countsDown: true)
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundColor(.orange)
                            .frame(maxWidth: 40, alignment: .trailing)
                            .padding(.trailing, 4)
                    }
                } else if context.state.isPaused {
                    Image(systemName: "pause.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.trailing, 4)
                } else {
                    Text("\(context.state.currentRep)/\(context.state.reps)")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .padding(.trailing, 4)
                }
            } minimal: {
                Image(systemName: context.state.iconName)
                    .foregroundColor(context.state.accentColor)
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
