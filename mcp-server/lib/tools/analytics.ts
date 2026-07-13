import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpUser } from '../auth'
import { getUserContext } from '../user-context'
import { getFirebaseClient } from '../firebase-client'
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  Timestamp,
} from 'firebase/firestore'
import { getDaysBackRange } from '../date-utils'
import { formatWeight, formatCalories, formatShortDate } from '../formatters'
import {
  analyzeTDEE,
  type RawWeightLog,
  type RawCalorieLog,
  type TDEEConfigData,
  type WeightUnit,
  type EnergyUnit,
} from '../tdee-adapter'
import { calculateTrends } from '../../../utils/analyticsUtils'
import type { WorkoutSet } from '../../../declarations'

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    'get_tdee_analysis',
    'Get your adaptive TDEE (Total Daily Energy Expenditure) calculation, current weight, weight change, and goal tracking information.',
    {
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

      // Fetch user doc for TDEE config
      const userDoc = await getDoc(doc(db, `users/${user.uid}`))
      const userData = userDoc.data() || {}
      const tdeeConfig = userData.tdeeConfig as
        | {
            weightUnit?: string
            energyUnit?: string
            smoothingWindowWeeks?: number
            goalWeight?: number
            goalWeeklyRate?: number
            gender?: string
            heightValue?: number
            measurementUnit?: string
            waistValue?: number
            neckValue?: number
            hipValue?: number
          }
        | undefined

      if (!tdeeConfig) {
        return {
          content: [
            {
              type: 'text' as const,
              text: '📈 TDEE Analysis\n\nTDEE tracking has not been configured yet. Set up your TDEE preferences in the app first (Analytics > Health & TDEE > Setup).',
            },
          ],
        }
      }

      // Fetch weight and calorie logs (cap to 1 year)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      const cutoff = Timestamp.fromDate(oneYearAgo)

      // Fetch newest-first: analyzeTDEE expects descending order and derives
      // the starting weight (F6) from the oldest log in the window.
      const [weightSnap, calorieSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, `users/${user.uid}/weightLogs`),
            where('date', '>=', cutoff),
            orderBy('date', 'desc'),
          ),
        ),
        getDocs(
          query(
            collection(db, `users/${user.uid}/calorieLogs`),
            where('date', '>=', cutoff),
            orderBy('date', 'desc'),
          ),
        ),
      ])

      const weightLogs = weightSnap.docs.map((d) =>
        d.data(),
      ) as unknown as RawWeightLog[]
      const calorieLogs = calorieSnap.docs.map((d) =>
        d.data(),
      ) as unknown as RawCalorieLog[]

      if (weightLogs.length === 0 && calorieLogs.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: '📈 TDEE Analysis\n\nNo weight or calorie data found. Start logging your daily weight and calories to calculate your TDEE.',
            },
          ],
        }
      }

      // Run the spreadsheet-faithful TDEE pipeline (shared with the app)
      const configData: TDEEConfigData = {
        weightUnit: (tdeeConfig.weightUnit as WeightUnit) || 'kg',
        energyUnit: (tdeeConfig.energyUnit as EnergyUnit) || 'cal',
        smoothingWindowWeeks: tdeeConfig.smoothingWindowWeeks,
        goalWeight: tdeeConfig.goalWeight,
        goalWeeklyRate: tdeeConfig.goalWeeklyRate,
        gender: tdeeConfig.gender as TDEEConfigData['gender'],
        heightValue: tdeeConfig.heightValue,
        measurementUnit:
          tdeeConfig.measurementUnit as TDEEConfigData['measurementUnit'],
        waistValue: tdeeConfig.waistValue,
        neckValue: tdeeConfig.neckValue,
        hipValue: tdeeConfig.hipValue,
      }

      const analysis = analyzeTDEE(weightLogs, calorieLogs, configData)

      const lines: string[] = []
      lines.push('📈 TDEE Analysis')
      lines.push('')

      if (analysis.displayTDEE !== null) {
        lines.push(
          `Current TDEE: ${formatCalories(analysis.displayTDEE, ctx.energyUnit)}/day`,
        )
      }
      if (analysis.currentWeight !== null) {
        lines.push(
          `Current Weight: ${formatWeight(analysis.currentWeight, ctx.weightUnit)}`,
        )
      }
      if (analysis.totalWeightChange !== null) {
        const sign = analysis.totalWeightChange >= 0 ? '+' : ''
        lines.push(
          `Weight Change: ${sign}${analysis.totalWeightChange.toFixed(1)} ${ctx.weightUnit} (since tracking began)`,
        )
      }
      lines.push(`Weeks of Data: ${analysis.weeksWithData}`)

      if (!analysis.hasEnoughData) {
        lines.push('')
        lines.push(
          'ℹ️ Need at least 2 weeks of weight + calorie data for accurate TDEE calculation.',
        )
      }

      // Goal tracking
      if (
        tdeeConfig.goalWeight !== undefined &&
        analysis.displayTDEE !== null
      ) {
        lines.push('')
        lines.push('🎯 Goal:')
        lines.push(
          `  Target Weight: ${formatWeight(tdeeConfig.goalWeight, ctx.weightUnit)}`,
        )

        if (
          analysis.goalCalories !== null &&
          analysis.dailyDeficit !== null &&
          analysis.weeksToGoal !== null &&
          analysis.currentWeight !== null
        ) {
          const isLosing = tdeeConfig.goalWeight < analysis.currentWeight
          lines.push(
            `  Goal Calories: ${formatCalories(analysis.goalCalories, ctx.energyUnit)}/day`,
          )
          lines.push(
            `  Daily ${isLosing ? 'Deficit' : 'Surplus'}: ${formatCalories(analysis.dailyDeficit, ctx.energyUnit)}`,
          )
          lines.push(`  Weeks to Goal: ${analysis.weeksToGoal}`)
          if (analysis.goalDate !== null) {
            const [gy, gm, gd] = analysis.goalDate.split('-').map(Number)
            lines.push(
              `  Estimated Date: ${formatShortDate(new Date(gy, gm - 1, gd), tz, true)}`,
            )
          }
        }
      }

      // Weekly breakdown (last 4 weeks)
      if (analysis.recentWeeks.length > 0) {
        lines.push('')
        lines.push('📊 Weekly Breakdown (Recent):')
        const recentWeeks = analysis.recentWeeks.slice(-4)
        for (const week of recentWeeks) {
          const [sy, sm, sd] = week.weekStart.split('-').map(Number)
          const [ey, em, ed] = week.weekEnd.split('-').map(Number)
          const startStr = new Date(sy, sm - 1, sd).toLocaleDateString(
            'en-US',
            { month: 'short', day: 'numeric' },
          )
          const endStr = new Date(ey, em - 1, ed).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
          const parts: string[] = [`${startStr} - ${endStr}:`]
          if (week.avgWeight !== null) {
            parts.push(
              `Avg Weight ${formatWeight(Math.round(week.avgWeight * 10) / 10, ctx.weightUnit)}`,
            )
          }
          if (week.avgCalories !== null) {
            parts.push(
              `Avg Calories ${formatCalories(week.avgCalories, ctx.energyUnit)}`,
            )
          }
          if (week.displayTDEE !== null) {
            parts.push(
              `TDEE ${formatCalories(week.displayTDEE, ctx.energyUnit)}`,
            )
          }
          lines.push(`  ${parts.join(' | ')}`)
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )

  server.tool(
    'get_exercise_trends',
    'Get historical performance trends for a specific exercise, showing average weight and reps per session.',
    {
      exercise_name: z.string().describe('Exercise name to analyze'),
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
          orderBy('date', 'asc'),
        ),
      )

      const filterName = args.exercise_name.toLowerCase()

      // Find matching exercise ID from raw data
      let exerciseDisplayName = args.exercise_name
      let matchingExerciseId: string | null = null

      const allSets = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as unknown as WorkoutSet[]

      for (const s of allSets) {
        if (s.exerciseName.toLowerCase().includes(filterName)) {
          exerciseDisplayName = s.exerciseName
          matchingExerciseId = s.exerciseId
          break
        }
      }

      if (!matchingExerciseId) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `📈 Exercise Trends: ${args.exercise_name}\n\nNo data found for this exercise in the last 90 days.`,
            },
          ],
        }
      }

      // Use shared calculateTrends from mobile app's analyticsUtils
      const trends = calculateTrends(allSets, matchingExerciseId)

      if (trends.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `📈 Exercise Trends: ${exerciseDisplayName}\n\nNo data found for this exercise in the last 90 days.`,
            },
          ],
        }
      }

      const lines: string[] = []
      lines.push(`📈 Exercise Trends: ${exerciseDisplayName}`)
      lines.push('')

      const recentTrends = trends.slice(-10)
      lines.push(`Session History (Last ${recentTrends.length}):`)
      for (const t of [...recentTrends].reverse()) {
        const dateLabel = t.date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        lines.push(
          `  ${dateLabel}: ${t.setCount} sets — Avg ${formatWeight(t.avgWeight, ctx.weightUnit)} × ${t.avgReps} reps`,
        )
      }

      // Progress summary
      if (trends.length >= 2) {
        const first = trends[0]
        const last = trends[trends.length - 1]
        const delta = last.avgWeight - first.avgWeight
        const sign = delta >= 0 ? '+' : ''
        lines.push('')
        lines.push(
          `Progress: ${formatWeight(first.avgWeight, ctx.weightUnit)} → ${formatWeight(last.avgWeight, ctx.weightUnit)} (${sign}${delta.toFixed(1)} ${ctx.weightUnit} over ${trends.length} sessions)`,
        )
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )
}
