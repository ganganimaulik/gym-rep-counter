import ActivityKit
import WidgetKit
import SwiftUI
import workout_attributes

struct WidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            // Lock screen/banner UI
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 16) {
                    // Left Icon
                    ZStack {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(context.state.isResting ? Color.orange.opacity(0.15) : Color.blue.opacity(0.15))
                            .frame(width: 52, height: 52)
                        
                        Image(systemName: context.state.isResting ? "timer" : "dumbbell.fill")
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundColor(context.state.isResting ? .orange : .blue)
                    }
                    
                    // Center Content
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.isResting ? "Rest Timer" : context.state.exerciseName)
                            .font(.system(.headline, design: .rounded))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                        
                        if context.state.isResting {
                            Text("Up Next: Set \(context.state.currentSet) of \(context.state.totalSets)")
                                .font(.system(.subheadline, design: .rounded))
                                .foregroundColor(.gray)
                                .lineLimit(1)
                        } else {
                            HStack(spacing: 6) {
                                Text("Set \(context.state.currentSet)/\(context.state.totalSets)")
                                Text("•")
                                Text("\(context.state.reps) Reps")
                            }
                            .font(.system(.subheadline, design: .rounded))
                            .foregroundColor(.gray)
                            .lineLimit(1)
                        }
                    }
                    
                    Spacer(minLength: 0)
                    
                    // Trailing Content
                    if context.state.isResting {
                        let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                        let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                        
                        Text(timerInterval: startDate...endDate, countsDown: true)
                            .font(.system(.title2, design: .monospaced))
                            .fontWeight(.bold)
                            .foregroundColor(.orange)
                            .multilineTextAlignment(.trailing)
                    } else {
                        ZStack {
                            Circle()
                                .stroke(Color.blue.opacity(0.3), lineWidth: 4)
                                .frame(width: 46, height: 46)
                            
                            Circle()
                                .trim(from: 0, to: CGFloat(context.state.currentSet) / CGFloat(max(1, context.state.totalSets)))
                                .stroke(Color.blue, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                                .frame(width: 46, height: 46)
                                .rotationEffect(.degrees(-90))
                            
                            Text("\(context.state.currentSet)")
                                .font(.system(.title3, design: .rounded))
                                .fontWeight(.bold)
                                .foregroundColor(.blue)
                        }
                    }
                }
                
                if context.state.isResting {
                    let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                    let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                    
                    ProgressView(timerInterval: startDate...endDate, countsDown: true)
                        .tint(.orange)
                        .background(Color.zinc800)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
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
                            .fill(context.state.isResting ? Color.orange.opacity(0.15) : Color.blue.opacity(0.15))
                            .frame(width: 36, height: 36)
                        Image(systemName: context.state.isResting ? "timer" : "dumbbell.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(context.state.isResting ? .orange : .blue)
                    }
                    .padding(.leading, 4)
                }
                
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.isResting ? "Rest Timer" : context.state.exerciseName)
                        .font(.system(.headline, design: .rounded))
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isResting {
                        let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                        let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                        Text(timerInterval: startDate...endDate, countsDown: true)
                            .font(.system(.title3, design: .monospaced))
                            .fontWeight(.bold)
                            .foregroundColor(.orange)
                            .frame(width: 60, alignment: .trailing)
                            .padding(.trailing, 4)
                    } else {
                        VStack(alignment: .trailing, spacing: 0) {
                            Text("SET")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundColor(.blue)
                            Text("\(context.state.currentSet)")
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
                            let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                            let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                            
                            Text("Up Next: Set \(context.state.currentSet) of \(context.state.totalSets)")
                                .font(.system(.subheadline, design: .rounded))
                                .foregroundColor(.gray)
                                .lineLimit(1)
                                .padding(.horizontal, 8)
                            
                            ProgressView(timerInterval: startDate...endDate, countsDown: true)
                                .tint(.orange)
                                .background(Color.zinc800)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
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
                                    Text("\(context.state.reps) Reps")
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
                    Image(systemName: context.state.isResting ? "timer" : "dumbbell.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(context.state.isResting ? .orange : .blue)
                    
                    if !context.state.isResting {
                        Text("S\(context.state.currentSet)")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                }
                .padding(.leading, 4)
            } compactTrailing: {
                if context.state.isResting {
                    let startDate = Date(timeIntervalSince1970: context.state.restStartTimestamp / 1000.0)
                    let endDate = startDate.addingTimeInterval(Double(context.state.restSeconds))
                    Text(timerInterval: startDate...endDate, countsDown: true)
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .foregroundColor(.orange)
                        .frame(maxWidth: 40, alignment: .trailing)
                        .padding(.trailing, 4)
                } else {
                    Text("\(context.state.reps)R")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .padding(.trailing, 4)
                }
            } minimal: {
                Image(systemName: context.state.isResting ? "timer" : "dumbbell.fill")
                    .foregroundColor(context.state.isResting ? .orange : .blue)
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
