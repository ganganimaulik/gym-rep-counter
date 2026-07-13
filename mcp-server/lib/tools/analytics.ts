import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpUser } from '../auth'
import { getUserContext } from '../user-context'
import { getFirebaseAdmin } from '../firebase-admin'
import { getDaysBackRange, getDateStringFromTimestamp } from '../date-utils'
import { formatWeight, formatCalories, formatShortDate } from '../formatters'
import {
  analyzeTDEE,
  type RawWeightLog,
  type RawCalorieLog,
  type TDEEConfigData,
  type WeightUnit,
  type EnergyUnit,
} from '../tdee-calculator'

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
      const { db } = getFirebaseAdmin()
      const tz = args.timezone || 'UTC'

      // Fetch user doc for TDEE config
      const userDoc = await db.doc(`users/${user.uid}`).get()
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
      const { Timestamp } = await import('firebase-admin/firestore')
      const cutoff = Timestamp.fromDate(oneYearAgo)

      // Fetch newest-first: analyzeTDEE expects descending order and derives
      // the starting weight (F6) from the oldest log in the window.
      const [weightSnap, calorieSnap] = await Promise.all([
        db
          .collection(`users/${user.uid}/weightLogs`)
          .where('date', '>=', cutoff)
          .orderBy('date', 'desc')
          .get(),
        db
          .collection(`users/${user.uid}/calorieLogs`)
          .where('date', '>=', cutoff)
          .orderBy('date', 'desc')
          .get(),
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
      const { db } = getFirebaseAdmin()
      const tz = args.timezone || 'UTC'
      const { start, end } = getDaysBackRange(90, tz)

      const snap = await db
        .collection(`users/${user.uid}/history`)
        .where('date', '>=', start)
        .where('date', '<', end)
        .orderBy('date', 'asc')
        .get()

      const filterName = args.exercise_name.toLowerCase()
      const filtered = snap.docs
        .map((d) => d.data())
        .filter((s) =>
          (s.exerciseName as string).toLowerCase().includes(filterName),
        )

      if (filtered.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `📈 Exercise Trends: ${args.exercise_name}\n\nNo data found for this exercise in the last 90 days.`,
            },
          ],
        }
      }

      // Group by date to get per-session averages
      const sessionMap = new Map<
        string,
        { totalWeight: number; totalReps: number; count: number }
      >()
      for (const s of filtered) {
        const dateStr = getDateStringFromTimestamp(
          s.date as FirebaseFirestore.Timestamp,
          tz,
        )
        const existing = sessionMap.get(dateStr) || {
          totalWeight: 0,
          totalReps: 0,
          count: 0,
        }
        existing.totalWeight += s.weight as number
        existing.totalReps += s.reps as number
        existing.count++
        sessionMap.set(dateStr, existing)
      }

      const sessions = Array.from(sessionMap.entries())
        .map(([dateStr, data]) => ({
          dateStr,
          avgWeight: Math.round((data.totalWeight / data.count) * 10) / 10,
          avgReps: Math.round((data.totalReps / data.count) * 10) / 10,
          setCount: data.count,
        }))
        .sort((a, b) => a.dateStr.localeCompare(b.dateStr))

      // Use the exercise name from the first matching record
      const exerciseDisplayName = filtered[0].exerciseName as string

      const lines: string[] = []
      lines.push(`📈 Exercise Trends: ${exerciseDisplayName}`)
      lines.push('')

      const recentSessions = sessions.slice(-10)
      lines.push(`Session History (Last ${recentSessions.length}):`)
      for (const s of recentSessions.reverse()) {
        const [y, m, d] = s.dateStr.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const dateLabel = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        lines.push(
          `  ${dateLabel}: ${s.setCount} sets — Avg ${formatWeight(s.avgWeight, ctx.weightUnit)} × ${s.avgReps} reps`,
        )
      }

      // Progress summary
      if (sessions.length >= 2) {
        const first = sessions[0]
        const last = sessions[sessions.length - 1]
        const delta = last.avgWeight - first.avgWeight
        const sign = delta >= 0 ? '+' : ''
        lines.push('')
        lines.push(
          `Progress: ${formatWeight(first.avgWeight, ctx.weightUnit)} → ${formatWeight(last.avgWeight, ctx.weightUnit)} (${sign}${delta.toFixed(1)} ${ctx.weightUnit} over ${sessions.length} sessions)`,
        )
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )
}
