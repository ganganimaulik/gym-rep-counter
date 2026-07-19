import type {
  WorkoutSet,
  PRRecord,
  StreakInfo,
  VolumeData,
  TrendData,
  ExerciseTrendSeries,
  WeightUnit,
} from '../declarations'

// Order units render in: kg first, then plates
const UNIT_ORDER: WeightUnit[] = ['kg', 'plates']

/**
 * Unit a set was logged in; sets predating weight units are treated as kg.
 */
function getSetUnit(set: WorkoutSet): WeightUnit {
  return set.weightUnit ?? 'kg'
}

/**
 * Format a Date to a YYYY-MM-DD string in the system's local timezone.
 */
function toLocalYMD(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD string into a local Date object.
 */
function parseLocalYMD(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
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
  return toLocalYMD(weekStart)
}

/**
 * Calculate Personal Records (PRs) - max weight lifted per exercise and unit.
 * Kg and plates weights are never compared against each other, so an exercise
 * logged in both units gets a separate PR per unit.
 */
export function calculatePRs(
  history: WorkoutSet[],
  exerciseId?: string,
): PRRecord[] {
  const filtered = exerciseId
    ? history.filter((h) => h.exerciseId === exerciseId)
    : history

  // Group by exercise + unit to find max weight for each
  const exerciseMap = new Map<string, { set: WorkoutSet; maxWeight: number }>()

  for (const set of filtered) {
    const key = `${set.exerciseId}::${getSetUnit(set)}`
    const existing = exerciseMap.get(key)
    if (!existing || set.weight > existing.maxWeight) {
      exerciseMap.set(key, { set, maxWeight: set.weight })
    }
  }

  // Convert map to PRRecord array
  const prs: PRRecord[] = []
  for (const [, { set }] of exerciseMap) {
    prs.push({
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      maxWeight: set.weight,
      weightUnit: getSetUnit(set),
      repsAtMax: set.reps,
      date: set.date,
    })
  }

  // Kg PRs first, then plates; heaviest first within each unit
  return prs.sort((a, b) =>
    a.weightUnit === b.weightUnit
      ? b.maxWeight - a.maxWeight
      : UNIT_ORDER.indexOf(a.weightUnit) - UNIT_ORDER.indexOf(b.weightUnit),
  )
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
    const dateStr = toLocalYMD(set.date.toDate())
    workoutDates.add(dateStr)
  }

  // Group dates by week
  const weekWorkouts = new Map<string, Set<string>>()
  for (const dateStr of workoutDates) {
    const date = parseLocalYMD(dateStr)
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
  const lastWorkoutDate =
    allDates.length > 0 ? parseLocalYMD(allDates[0]) : null

  // Calculate streak (consecutive weeks with 5+ workouts)
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0

  // Start from the most recent completed week (or current if it qualifies)
  for (let i = 0; i < sortedWeeks.length; i++) {
    const weekKey = sortedWeeks[i]
    const weekDays = weekWorkouts.get(weekKey)!.size

    // For current week, we check if we're on track (don't require minDaysPerWeek yet if week isn't over)
    const isCurrentWeek = weekKey === currentWeekKey
    const qualifies = isCurrentWeek
      ? weekDays > 0 // Current week counts if any workout done
      : weekDays >= minDaysPerWeek // Past weeks need minDaysPerWeek+ days

    if (qualifies) {
      // Check if this is consecutive with previous week
      if (i === 0) {
        tempStreak = 1
      } else {
        const prevWeekKey = sortedWeeks[i - 1]
        const prevWeekStart = parseLocalYMD(prevWeekKey)
        const thisWeekStart = parseLocalYMD(weekKey)
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

  currentStreak = 0
  if (sortedWeeks.length > 0) {
    const firstWeekKey = sortedWeeks[0]
    const firstWeekDate = parseLocalYMD(firstWeekKey)
    const currentWeekDate = getWeekStart(now)

    // Check if the most recent week is current week or last week
    const diffFromCurrent = Math.round(
      (currentWeekDate.getTime() - firstWeekDate.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    )

    if (diffFromCurrent <= 1) {
      let continuous = 0
      for (let i = 0; i < sortedWeeks.length; i++) {
        const wKey = sortedWeeks[i]
        const wDays = weekWorkouts.get(wKey)!.size
        const wDate = parseLocalYMD(wKey)

        const expectedDiff = diffFromCurrent + i
        const actualDiff = Math.round(
          (currentWeekDate.getTime() - wDate.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        )

        if (actualDiff !== expectedDiff) break

        if (actualDiff === 0) {
          if (wDays > 0) continuous++
          else break
        } else {
          if (wDays >= minDaysPerWeek) continuous++
          else break
        }
      }
      currentStreak = continuous
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
 * Optimized: builds a date-indexed volume map in a single pass over history,
 * then sums relevant date buckets per period (O(n + m*d) vs O(n*m))
 */
export function calculateVolume(
  history: WorkoutSet[],
  period: 'week' | 'month',
  count: number = 8,
): VolumeData[] {
  if (history.length === 0) {
    return []
  }

  // Single pass: build a map of date string -> per-unit volume for that day.
  // Kg and plates volumes are kept apart — summing them would be meaningless.
  const dailyVolume = new Map<string, { kg: number; plates: number }>()
  for (const set of history) {
    const d = set.date.toDate()
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    const dateKey = `${year}-${month}-${day}`
    const volume = set.weight * set.reps
    const bucket = dailyVolume.get(dateKey) || { kg: 0, plates: 0 }
    bucket[getSetUnit(set)] += volume
    dailyVolume.set(dateKey, bucket)
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

      // Sum volume for each day in this week from the pre-built map
      let kgVolume = 0
      let platesVolume = 0
      const cursor = new Date(weekStart)
      for (let d = 0; d < 7; d++) {
        const year = cursor.getFullYear()
        const month = (cursor.getMonth() + 1).toString().padStart(2, '0')
        const day = cursor.getDate().toString().padStart(2, '0')
        const dateKey = `${year}-${month}-${day}`
        const bucket = dailyVolume.get(dateKey)
        if (bucket) {
          kgVolume += bucket.kg
          platesVolume += bucket.plates
        }
        cursor.setDate(cursor.getDate() + 1)
      }

      volumeData.unshift({
        label: `W${count - i}`,
        startDate: weekStart,
        endDate: weekEndDate,
        kgVolume,
        platesVolume,
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

      // Sum volume for each day in this month from the pre-built map
      let kgVolume = 0
      let platesVolume = 0
      const daysInMonth = monthEnd.getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const year = monthStart.getFullYear()
        const month = (monthStart.getMonth() + 1).toString().padStart(2, '0')
        const day = d.toString().padStart(2, '0')
        const dateKey = `${year}-${month}-${day}`
        const bucket = dailyVolume.get(dateKey)
        if (bucket) {
          kgVolume += bucket.kg
          platesVolume += bucket.plates
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
        kgVolume,
        platesVolume,
      })
    }
  }

  return volumeData
}

/**
 * Calculate trends over time for a specific exercise, one series per weight
 * unit. Averaging kg and plates sets together would produce meaningless
 * numbers, so days are aggregated within each unit only.
 */
export function calculateTrends(
  history: WorkoutSet[],
  exerciseId: string,
): ExerciseTrendSeries[] {
  const filtered = history.filter((h) => h.exerciseId === exerciseId)

  if (filtered.length === 0) {
    return []
  }

  // Group by unit, then by date
  const unitDateMap = new Map<
    WeightUnit,
    Map<string, { totalWeight: number; totalReps: number; count: number }>
  >()

  for (const set of filtered) {
    const unit = getSetUnit(set)
    let dateMap = unitDateMap.get(unit)
    if (!dateMap) {
      dateMap = new Map()
      unitDateMap.set(unit, dateMap)
    }
    const dateStr = toLocalYMD(set.date.toDate())
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

  // Convert to per-unit series with sorted TrendData arrays
  const series: ExerciseTrendSeries[] = []
  for (const unit of UNIT_ORDER) {
    const dateMap = unitDateMap.get(unit)
    if (!dateMap) continue

    const trends: TrendData[] = []
    for (const [dateStr, data] of dateMap) {
      trends.push({
        date: parseLocalYMD(dateStr),
        avgWeight: Math.round((data.totalWeight / data.count) * 10) / 10,
        avgReps: Math.round((data.totalReps / data.count) * 10) / 10,
        setCount: data.count,
      })
    }

    series.push({
      weightUnit: unit,
      data: trends.sort((a, b) => a.date.getTime() - b.date.getTime()),
    })
  }

  return series
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
