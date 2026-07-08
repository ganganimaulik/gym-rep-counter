import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpUser } from '../auth'
import { getUserContext } from '../user-context'
import { getFirebaseAdmin } from '../firebase-admin'
import {
  getDaysBackRange,
  getDateStringFromTimestamp,
  toDate,
  getWeekStart,
} from '../date-utils'
import {
  formatDate,
  formatTime,
  formatDuration,
  formatWeight,
  formatShortDate,
} from '../formatters'
import { Timestamp } from 'firebase-admin/firestore'

export function registerWorkoutTools(server: McpServer) {
  server.tool(
    'get_workout_history',
    'View completed workout sets grouped by day, with rest times between sets. Shows exercise name, reps, weight, and time.',
    {
      days_back: z
        .number()
        .min(1)
        .max(90)
        .optional()
        .describe('Number of days of history to fetch. Default: 7, max: 90'),
      exercise_name: z
        .string()
        .optional()
        .describe('Filter to a specific exercise name'),
      timezone: z
        .string()
        .optional()
        .describe('IANA timezone (e.g., "America/New_York"). Defaults to UTC.'),
    },
    async (args, extra) => {
      const user = getMcpUser(extra)
      const ctx = await getUserContext(user.uid)
      const { db } = getFirebaseAdmin()
      const tz = args.timezone || 'UTC'
      const daysBack = args.days_back ?? 7
      const { start, end } = getDaysBackRange(daysBack, tz)

      const query = db
        .collection(`users/${user.uid}/history`)
        .where('date', '>=', start)
        .where('date', '<', end)
        .orderBy('date', 'desc')

      const snap = await query.get()
      let sets = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<
        Record<string, unknown>
      >

      // Filter by exercise name if provided
      if (args.exercise_name) {
        const filterName = args.exercise_name.toLowerCase()
        sets = sets.filter((s) =>
          (s.exerciseName as string).toLowerCase().includes(filterName),
        )
      }

      if (sets.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `📋 Workout History (Last ${daysBack} Days)\n\nNo workout sets found.`,
            },
          ],
        }
      }

      // Group by date
      const grouped: Record<string, Array<Record<string, unknown>>> = {}
      for (const s of sets) {
        const dateKey = getDateStringFromTimestamp(
          s.date as FirebaseFirestore.Timestamp,
          tz,
        )
        if (!grouped[dateKey]) grouped[dateKey] = []
        grouped[dateKey].push(s)
      }

      const lines: string[] = []
      lines.push(`📋 Workout History (Last ${daysBack} Days)`)
      lines.push('')

      const sortedDates = Object.keys(grouped).sort((a, b) =>
        b.localeCompare(a),
      )
      for (const dateKey of sortedDates) {
        const daySets = grouped[dateKey].sort((a, b) => {
          const aTime = toDate(a.date).getTime()
          const bTime = toDate(b.date).getTime()
          return aTime - bTime
        })

        lines.push(`${formatDate(daySets[0].date, tz)}:`)

        // Group by exercise within the day
        const exerciseOrder: string[] = []
        const exerciseGroups: Record<
          string,
          Array<Record<string, unknown>>
        > = {}
        for (const s of daySets) {
          const name = s.exerciseName as string
          if (!exerciseGroups[name]) {
            exerciseGroups[name] = []
            exerciseOrder.push(name)
          }
          exerciseGroups[name].push(s)
        }

        for (const name of exerciseOrder) {
          const exSets = exerciseGroups[name]
          lines.push(`  ${name}:`)
          for (let i = 0; i < exSets.length; i++) {
            const s = exSets[i]
            const setNum = s.set as number
            const reps = s.reps as number
            const weight = s.weight as number
            const time = formatTime(s.date, tz)

            let restStr = ''
            // Calculate rest time from previous set
            if (i > 0 && s.startTime) {
              const prevEndTime = toDate(exSets[i - 1].date).getTime()
              const thisStartTime = toDate(s.startTime).getTime()
              const restMs = thisStartTime - prevEndTime
              if (restMs > 0) {
                restStr = ` — ${formatDuration(restMs)} rest`
              }
            }

            lines.push(
              `    Set ${setNum}: ${reps} reps @ ${formatWeight(weight, ctx.weightUnit)} (${time})${restStr}`,
            )
          }
        }
        lines.push('')
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n').trimEnd() }],
      }
    },
  )

  server.tool(
    'log_workout_set',
    'Log a completed workout set with exercise name, reps, and weight.',
    {
      exercise_name: z.string().describe('Name of the exercise'),
      reps: z.number().int().min(1).describe('Number of reps completed'),
      weight: z
        .number()
        .min(0)
        .describe('Weight used (in your configured unit)'),
      set_number: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Set number. Auto-incremented if omitted.'),
      workout_name: z
        .string()
        .optional()
        .describe('Name of the workout routine this set belongs to'),
      timezone: z
        .string()
        .optional()
        .describe('IANA timezone (e.g., "America/New_York"). Defaults to UTC.'),
    },
    async (args, extra) => {
      const user = getMcpUser(extra)
      const ctx = await getUserContext(user.uid)
      const { db } = getFirebaseAdmin()
      const tz = args.timezone || 'UTC'

      // Find workout and exercise IDs
      let workoutId = 'manual'
      let exerciseId = `manual-${args.exercise_name.toLowerCase().replace(/\s+/g, '-')}`

      if (args.workout_name) {
        const userDoc = await db.doc(`users/${user.uid}`).get()
        const userData = userDoc.data()
        if (userData?.workouts) {
          const workouts = userData.workouts as Array<{
            id: string
            name: string
            exercises: Array<{ id: string; name: string }>
          }>
          const workout = workouts.find((w) =>
            w.name.toLowerCase().includes(args.workout_name!.toLowerCase()),
          )
          if (workout) {
            workoutId = workout.id
            const exercise = workout.exercises.find((e) =>
              e.name.toLowerCase().includes(args.exercise_name.toLowerCase()),
            )
            if (exercise) {
              exerciseId = exercise.id
            }
          }
        }
      }

      // Auto-determine set number if not provided
      let setNumber = args.set_number
      if (!setNumber) {
        // Count today's sets for this exercise
        const { start, end } = getDaysBackRange(0, tz)
        const todaySets = await db
          .collection(`users/${user.uid}/history`)
          .where('exerciseId', '==', exerciseId)
          .where('date', '>=', start)
          .where('date', '<', end)
          .get()
        setNumber = todaySets.size + 1
      }

      const now = Timestamp.now()
      await db.collection(`users/${user.uid}/history`).add({
        workoutId,
        exerciseId,
        exerciseName: args.exercise_name,
        reps: args.reps,
        weight: args.weight,
        set: setNumber,
        date: now,
      })

      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ Logged: ${args.exercise_name} — ${args.reps} reps @ ${formatWeight(args.weight, ctx.weightUnit)} (Set ${setNumber})`,
          },
        ],
      }
    },
  )

  server.tool(
    'get_workout_routines',
    'View all saved workout routines with their exercises, sets, and reps.',
    {},
    async (_args, extra) => {
      const user = getMcpUser(extra)
      const { db } = getFirebaseAdmin()

      const userDoc = await db.doc(`users/${user.uid}`).get()
      const userData = userDoc.data()
      const workouts = (userData?.workouts || []) as Array<{
        id: string
        name: string
        exercises: Array<{
          id: string
          name: string
          sets: number
          reps: number
        }>
      }>

      if (workouts.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: '📋 Your Workout Routines\n\nNo routines saved yet.',
            },
          ],
        }
      }

      const lines: string[] = []
      lines.push('📋 Your Workout Routines')
      lines.push('')

      for (let i = 0; i < workouts.length; i++) {
        const w = workouts[i]
        lines.push(`${i + 1}. ${w.name}`)
        for (const ex of w.exercises) {
          lines.push(`   • ${ex.name}: ${ex.sets} sets × ${ex.reps} reps`)
        }
        lines.push('')
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n').trimEnd() }],
      }
    },
  )

  server.tool(
    'get_personal_records',
    'View personal records (max weight lifted) across all exercises, plus workout streak info.',
    {
      exercise_name: z
        .string()
        .optional()
        .describe('Filter to a specific exercise name'),
      timezone: z
        .string()
        .optional()
        .describe('IANA timezone (e.g., "America/New_York"). Defaults to UTC.'),
    },
    async (args, extra) => {
      const user = getMcpUser(extra)
      const ctx = await getUserContext(user.uid)
      const { db } = getFirebaseAdmin()
      const tz = args.timezone || 'UTC'
      const { start, end } = getDaysBackRange(90, tz)

      const snap = await db
        .collection(`users/${user.uid}/history`)
        .where('date', '>=', start)
        .where('date', '<', end)
        .orderBy('date', 'desc')
        .get()

      const allSets = snap.docs.map((d) => d.data()) as Array<
        Record<string, unknown>
      >

      if (allSets.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: '🏆 Personal Records\n\nNo workout data found in the last 90 days.',
            },
          ],
        }
      }

      // Calculate PRs - max weight per exercise
      const prMap: Record<
        string,
        { name: string; maxWeight: number; repsAtMax: number; date: unknown }
      > = {}
      for (const s of allSets) {
        const exerciseId = s.exerciseId as string
        const exerciseName = s.exerciseName as string
        const weight = s.weight as number
        const reps = s.reps as number

        if (
          args.exercise_name &&
          !exerciseName.toLowerCase().includes(args.exercise_name.toLowerCase())
        ) {
          continue
        }

        if (!prMap[exerciseId] || weight > prMap[exerciseId].maxWeight) {
          prMap[exerciseId] = {
            name: exerciseName,
            maxWeight: weight,
            repsAtMax: reps,
            date: s.date,
          }
        }
      }

      const prs = Object.values(prMap).sort((a, b) => b.maxWeight - a.maxWeight)

      // Calculate streak (weekly-based, 5+ workout days)
      const workoutDates = new Set<string>()
      for (const s of allSets) {
        const dateStr = getDateStringFromTimestamp(
          s.date as FirebaseFirestore.Timestamp,
          tz,
        )
        workoutDates.add(dateStr)
      }

      const weekWorkouts = new Map<string, Set<string>>()
      for (const dateStr of workoutDates) {
        const date = new Date(dateStr)
        const weekStart = getWeekStart(date)
        const weekKey = weekStart.toISOString().split('T')[0]
        if (!weekWorkouts.has(weekKey)) weekWorkouts.set(weekKey, new Set())
        weekWorkouts.get(weekKey)!.add(dateStr)
      }

      const sortedWeeks = Array.from(weekWorkouts.keys()).sort().reverse()
      const now = new Date()
      const currentWeekKey = getWeekStart(now).toISOString().split('T')[0]
      const currentWeekDays = weekWorkouts.get(currentWeekKey)?.size || 0

      let currentStreak = 0
      let longestStreak = 0
      let tempStreak = 0

      for (let i = 0; i < sortedWeeks.length; i++) {
        const weekKey = sortedWeeks[i]
        const weekDays = weekWorkouts.get(weekKey)!.size
        const isCurrentWeek = weekKey === currentWeekKey
        const qualifies = isCurrentWeek ? weekDays > 0 : weekDays >= 5

        if (qualifies) {
          if (i === 0) {
            tempStreak = 1
          } else {
            const prevWeek = new Date(sortedWeeks[i - 1])
            const thisWeek = new Date(weekKey)
            const diffDays = Math.round(
              (prevWeek.getTime() - thisWeek.getTime()) / (1000 * 60 * 60 * 24),
            )
            tempStreak = diffDays === 7 ? tempStreak + 1 : 1
          }
        } else {
          if (tempStreak > longestStreak) longestStreak = tempStreak
          tempStreak = 0
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak

      // Recalculate current streak from most recent
      currentStreak = 0
      if (sortedWeeks.length > 0) {
        const firstWeekDate = new Date(sortedWeeks[0])
        const currentWeekDate = getWeekStart(now)
        const diffFromCurrent = Math.round(
          (currentWeekDate.getTime() - firstWeekDate.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        )
        if (diffFromCurrent <= 1) {
          for (let i = 0; i < sortedWeeks.length; i++) {
            const wKey = sortedWeeks[i]
            const wDays = weekWorkouts.get(wKey)!.size
            const wDate = new Date(wKey)
            const expectedDiff = diffFromCurrent + i
            const actualDiff = Math.round(
              (currentWeekDate.getTime() - wDate.getTime()) /
                (7 * 24 * 60 * 60 * 1000),
            )
            if (actualDiff !== expectedDiff) break
            if (actualDiff === 0) {
              if (wDays > 0) currentStreak++
              else break
            } else {
              if (wDays >= 5) currentStreak++
              else break
            }
          }
        }
      }

      const lines: string[] = []
      lines.push('🏆 Personal Records')
      lines.push('')

      if (prs.length === 0) {
        lines.push('No records found.')
      } else {
        for (let i = 0; i < Math.min(prs.length, 10); i++) {
          const pr = prs[i]
          const dateStr = formatShortDate(pr.date, tz, true)
          lines.push(
            `${i + 1}. ${pr.name}: ${formatWeight(pr.maxWeight, ctx.weightUnit)} × ${pr.repsAtMax} reps (${dateStr})`,
          )
        }
      }

      lines.push('')
      lines.push(
        `🔥 Streak: ${currentStreak} consecutive weeks (5+ workout days/week)`,
      )
      lines.push(`   Longest streak: ${longestStreak} weeks`)
      lines.push(`   This week: ${currentWeekDays} days`)

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )
}
