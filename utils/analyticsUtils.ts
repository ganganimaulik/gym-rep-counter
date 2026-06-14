import type {
  WorkoutSet,
  PRRecord,
  StreakInfo,
  VolumeData,
  TrendData,
} from '../declarations'

/**
 * Calculate Personal Records (PRs) - max weight lifted per exercise
 */
export function calculatePRs(
  history: WorkoutSet[],
  exerciseId?: string,
): PRRecord[] {
  const filtered = exerciseId
    ? history.filter((h) => h.exerciseId === exerciseId)
    : history

  // Group by exercise to find max weight for each
  const exerciseMap = new Map<string, { set: WorkoutSet; maxWeight: number }>()

  for (const set of filtered) {
    const existing = exerciseMap.get(set.exerciseId)
    if (!existing || set.weight > existing.maxWeight) {
      exerciseMap.set(set.exerciseId, { set, maxWeight: set.weight })
    }
  }

  // Convert map to PRRecord array
  const prs: PRRecord[] = []
  for (const [, { set }] of exerciseMap) {
    prs.push({
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      maxWeight: set.weight,
      repsAtMax: set.reps,
      date: set.date,
    })
  }

  // Sort by max weight descending
  return prs.sort((a, b) => b.maxWeight - a.maxWeight)
}

/**
 * Get the start of a week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // getDay returns 0 for Sunday, 1 for Monday, etc.
  // We want Monday as start of week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get a unique week key string for grouping
 */
function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date)
  return weekStart.toISOString().split('T')[0]
}

/**
 * Calculate streak using weekly-based approach
 * A week must have 5+ workout days to count toward the streak
 */
export function calculateStreak(
  history: WorkoutSet[],
  minDaysPerWeek: number = 5,
): StreakInfo {
  if (history.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
      currentWeekWorkouts: 0,
    }
  }

  // Get unique workout dates
  const workoutDates = new Set<string>()
  for (const set of history) {
    const dateStr = set.date.toDate().toISOString().split('T')[0]
    workoutDates.add(dateStr)
  }

  // Group dates by week
  const weekWorkouts = new Map<string, Set<string>>()
  for (const dateStr of workoutDates) {
    const date = new Date(dateStr)
    const weekKey = getWeekKey(date)
    if (!weekWorkouts.has(weekKey)) {
      weekWorkouts.set(weekKey, new Set())
    }
    weekWorkouts.get(weekKey)!.add(dateStr)
  }

  // Get sorted week keys
  const sortedWeeks = Array.from(weekWorkouts.keys()).sort().reverse()

  // Current week info
  const now = new Date()
  const currentWeekKey = getWeekKey(now)
  const currentWeekDates = weekWorkouts.get(currentWeekKey) || new Set()
  const currentWeekWorkouts = currentWeekDates.size

  // Find last workout date
  const allDates = Array.from(workoutDates).sort().reverse()
  const lastWorkoutDate = allDates.length > 0 ? new Date(allDates[0]) : null

  // Calculate streak (consecutive weeks with 5+ workouts)
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0

  // Start from the most recent completed week (or current if it qualifies)
  for (let i = 0; i < sortedWeeks.length; i++) {
    const weekKey = sortedWeeks[i]
    const weekDays = weekWorkouts.get(weekKey)!.size

    // For current week, we check if we're on track (don't require 5 yet if week isn't over)
    const isCurrentWeek = weekKey === currentWeekKey
    const qualifies = isCurrentWeek
      ? weekDays > 0 // Current week counts if any workout done
      : weekDays >= minDaysPerWeek // Past weeks need 5+ days

    if (qualifies) {
      // Check if this is consecutive with previous week
      if (i === 0) {
        tempStreak = 1
      } else {
        const prevWeekKey = sortedWeeks[i - 1]
        const prevWeekStart = new Date(prevWeekKey)
        const thisWeekStart = new Date(weekKey)
        const diffDays = Math.round(
          (prevWeekStart.getTime() - thisWeekStart.getTime()) /
            (1000 * 60 * 60 * 24),
        )

        if (diffDays === 7) {
          tempStreak++
        } else {
          // Gap in weeks, streak breaks
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak
          }
          tempStreak = 1
        }
      }
    } else {
      // Week doesn't qualify, streak breaks
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak
      }
      tempStreak = 0
    }
  }

  // Check final streak
  if (tempStreak > longestStreak) {
    longestStreak = tempStreak
  }

  // Current streak is the most recent consecutive streak if it includes recent week
  currentStreak =
    sortedWeeks.length > 0 && sortedWeeks[0] === currentWeekKey ? tempStreak : 0

  // If the most recent week is last week (not current), still count it as current streak
  if (currentStreak === 0 && sortedWeeks.length > 0) {
    const lastWeekKey = sortedWeeks[0]
    const lastWeekDate = new Date(lastWeekKey)
    const lastWeekNum = Math.floor(
      lastWeekDate.getTime() / (7 * 24 * 60 * 60 * 1000),
    )
    const currentWeekNum = Math.floor(
      getWeekStart(now).getTime() / (7 * 24 * 60 * 60 * 1000),
    )

    if (currentWeekNum - lastWeekNum <= 1) {
      // Last week is the previous week, recompute temp streak
      let streak = 0
      for (const weekKey of sortedWeeks) {
        const weekDays = weekWorkouts.get(weekKey)!.size
        if (weekDays >= minDaysPerWeek) {
          streak++
        } else {
          break
        }
      }
      currentStreak = streak
    }
  }

  return {
    currentStreak,
    longestStreak,
    lastWorkoutDate,
    currentWeekWorkouts,
  }
}

/**
 * Calculate workout volume aggregated by week or month
 */
export function calculateVolume(
  history: WorkoutSet[],
  period: 'week' | 'month',
  count: number = 8,
): VolumeData[] {
  if (history.length === 0) {
    return []
  }

  const now = new Date()
  const volumeData: VolumeData[] = []

  if (period === 'week') {
    for (let i = 0; i < count; i++) {
      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() - i * 7)
      const weekStart = getWeekStart(weekEnd)
      const weekEndDate = new Date(weekStart)
      weekEndDate.setDate(weekEndDate.getDate() + 6)
      weekEndDate.setHours(23, 59, 59, 999)

      let totalVolume = 0
      for (const set of history) {
        const setDate = set.date.toDate()
        if (setDate >= weekStart && setDate <= weekEndDate) {
          totalVolume += set.weight * set.reps
        }
      }

      volumeData.unshift({
        label: `W${count - i}`,
        startDate: weekStart,
        endDate: weekEndDate,
        totalVolume,
      })
    }
  } else {
    // Monthly aggregation
    for (let i = 0; i < count; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        1,
      )
      const monthEnd = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      )

      let totalVolume = 0
      for (const set of history) {
        const setDate = set.date.toDate()
        if (setDate >= monthStart && setDate <= monthEnd) {
          totalVolume += set.weight * set.reps
        }
      }

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]

      volumeData.unshift({
        label: monthNames[monthDate.getMonth()],
        startDate: monthStart,
        endDate: monthEnd,
        totalVolume,
      })
    }
  }

  return volumeData
}

/**
 * Calculate trends over time for a specific exercise
 */
export function calculateTrends(
  history: WorkoutSet[],
  exerciseId: string,
): TrendData[] {
  const filtered = history.filter((h) => h.exerciseId === exerciseId)

  if (filtered.length === 0) {
    return []
  }

  // Group by date
  const dateMap = new Map<
    string,
    { totalWeight: number; totalReps: number; count: number }
  >()

  for (const set of filtered) {
    const dateStr = set.date.toDate().toISOString().split('T')[0]
    const existing = dateMap.get(dateStr) || {
      totalWeight: 0,
      totalReps: 0,
      count: 0,
    }
    existing.totalWeight += set.weight
    existing.totalReps += set.reps
    existing.count++
    dateMap.set(dateStr, existing)
  }

  // Convert to sorted TrendData array
  const trends: TrendData[] = []
  for (const [dateStr, data] of dateMap) {
    trends.push({
      date: new Date(dateStr),
      avgWeight: Math.round((data.totalWeight / data.count) * 10) / 10,
      avgReps: Math.round((data.totalReps / data.count) * 10) / 10,
      setCount: data.count,
    })
  }

  return trends.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Get unique exercises from history
 */
export function getUniqueExercises(
  history: WorkoutSet[],
): { id: string; name: string }[] {
  const exerciseMap = new Map<string, string>()

  for (const set of history) {
    if (!exerciseMap.has(set.exerciseId)) {
      exerciseMap.set(set.exerciseId, set.exerciseName)
    }
  }

  return Array.from(exerciseMap.entries()).map(([id, name]) => ({
    id,
    name,
  }))
}
