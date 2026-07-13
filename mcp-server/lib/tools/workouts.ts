import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpUser } from '../auth'
import { getUserContext } from '../user-context'
import { getFirebaseClient } from '../firebase-client'
import {
  getDaysBackRange,
  toDate,
  getDateStringFromTimestamp,
} from '../date-utils'
import {
  formatDate,
  formatTime,
  formatDuration,
  formatWeight,
  formatShortDate,
} from '../formatters'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  addDoc,
  Timestamp,
} from 'firebase/firestore'
import { calculateStreak, calculatePRs } from '../../../utils/analyticsUtils'
import type { WorkoutSet } from '../../../declarations'

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
      const { db } = getFirebaseClient()
      const tz = args.timezone || 'UTC'
      const daysBack = args.days_back ?? 7
      const { start, end } = getDaysBackRange(daysBack, tz)

      const q = query(
        collection(db, `users/${user.uid}/history`),
        where('date', '>=', start),
        where('date', '<', end),
        orderBy('date', 'desc'),
      )

      const snap = await getDocs(q)
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
        const dateKey = getDateStringFromTimestamp(s.date as Timestamp, tz)
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
      const { db } = getFirebaseClient()
      const tz = args.timezone || 'UTC'

      // Find workout and exercise IDs
      let workoutId = 'manual'
      let exerciseId = `manual-${args.exercise_name.toLowerCase().replace(/\s+/g, '-')}`

      if (args.workout_name) {
        const userDoc = await getDoc(doc(db, `users/${user.uid}`))
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
        const todaySets = await getDocs(
          query(
            collection(db, `users/${user.uid}/history`),
            where('exerciseId', '==', exerciseId),
            where('date', '>=', start),
            where('date', '<', end),
          ),
        )
        setNumber = todaySets.size + 1
      }

      const now = Timestamp.now()
      await addDoc(collection(db, `users/${user.uid}/history`), {
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
      const { db } = getFirebaseClient()

      const userDoc = await getDoc(doc(db, `users/${user.uid}`))
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
      const { db } = getFirebaseClient()
      const tz = args.timezone || 'UTC'
      const { start, end } = getDaysBackRange(90, tz)

      const snap = await getDocs(
        query(
          collection(db, `users/${user.uid}/history`),
          where('date', '>=', start),
          where('date', '<', end),
          orderBy('date', 'desc'),
        ),
      )

      const allSets = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as unknown as WorkoutSet[]

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

      // Filter by exercise name if provided
      const filteredSets = args.exercise_name
        ? allSets.filter((s) =>
            s.exerciseName
              .toLowerCase()
              .includes(args.exercise_name!.toLowerCase()),
          )
        : allSets

      // Calculate PRs using shared analytics utility (now uses Timestamp directly)
      const prs = calculatePRs(filteredSets)

      // Calculate streak using shared analytics utility
      const streakInfo = calculateStreak(allSets)
      const {
        currentStreak,
        longestStreak,
        currentWeekWorkouts: currentWeekDays,
      } = streakInfo

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
            `${i + 1}. ${pr.exerciseName}: ${formatWeight(pr.maxWeight, ctx.weightUnit)} × ${pr.repsAtMax} reps (${dateStr})`,
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
