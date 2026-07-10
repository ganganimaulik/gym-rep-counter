import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpUser } from '../auth'
import { getUserContext } from '../user-context'
import { getFirebaseAdmin } from '../firebase-admin'
import { getDaysBackRange, getDayRange, getTodayString } from '../date-utils'
import {
  formatDate,
  formatShortDate,
  formatWeight,
  formatCalories,
} from '../formatters'

export function registerNutritionTools(server: McpServer) {
  server.tool(
    'get_weight_logs',
    'View body weight history with trend information.',
    {
      days_back: z
        .number()
        .min(1)
        .max(365)
        .optional()
        .describe('Number of days of history. Default: 30'),
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
      const daysBack = args.days_back ?? 30
      const { start, end } = getDaysBackRange(daysBack, tz)

      const snap = await db
        .collection(`users/${user.uid}/weightLogs`)
        .where('date', '>=', start)
        .where('date', '<', end)
        .orderBy('date', 'desc')
        .get()

      const logs = snap.docs.map((d) => d.data())

      if (logs.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `⚖️ Weight Log (Last ${daysBack} Days)\n\nNo weight entries found.`,
            },
          ],
        }
      }

      const lines: string[] = []
      lines.push(`⚖️ Weight Log (Last ${daysBack} Days)`)
      lines.push('')

      for (const log of logs) {
        const dateStr = formatShortDate(log.date, tz)
        lines.push(
          `${dateStr}: ${formatWeight(log.weight as number, ctx.weightUnit)}`,
        )
      }

      // Trend
      const oldest = logs[logs.length - 1].weight as number
      const newest = logs[0].weight as number
      const delta = newest - oldest
      const sign = delta >= 0 ? '+' : ''
      lines.push('')
      lines.push(
        `Trend: ${formatWeight(oldest, ctx.weightUnit)} → ${formatWeight(newest, ctx.weightUnit)} (Δ ${sign}${delta.toFixed(1)} ${ctx.weightUnit})`,
      )

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )

  server.tool(
    'log_weight',
    'Log a body weight measurement for today or a specific date.',
    {
      weight: z.number().positive().describe('Body weight value'),
      date: z
        .string()
        .optional()
        .describe('Date in YYYY-MM-DD format. Defaults to today.'),
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
      const dateStr = args.date || getTodayString(tz)

      // Create a Timestamp for noon on the target date in user's timezone
      const { start } = getDayRange(dateStr, tz)

      await db.collection(`users/${user.uid}/weightLogs`).add({
        weight: args.weight,
        date: start,
      })

      const displayDate = formatDate(start, tz)
      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ Weight logged: ${formatWeight(args.weight, ctx.weightUnit)} on ${displayDate}`,
          },
        ],
      }
    },
  )

  server.tool(
    'get_calorie_logs',
    'View calorie intake history with daily averages.',
    {
      days_back: z
        .number()
        .min(1)
        .max(365)
        .optional()
        .describe('Number of days of history. Default: 30'),
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
      const daysBack = args.days_back ?? 30
      const { start, end } = getDaysBackRange(daysBack, tz)

      const snap = await db
        .collection(`users/${user.uid}/calorieLogs`)
        .where('date', '>=', start)
        .where('date', '<', end)
        .orderBy('date', 'desc')
        .get()

      const logs = snap.docs.map((d) => d.data())

      if (logs.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `🔥 Calorie Log (Last ${daysBack} Days)\n\nNo calorie entries found.`,
            },
          ],
        }
      }

      const lines: string[] = []
      lines.push(`🔥 Calorie Log (Last ${daysBack} Days)`)
      lines.push('')

      for (const log of logs) {
        const dateStr = formatShortDate(log.date, tz)
        lines.push(
          `${dateStr}: ${formatCalories(log.calories as number, ctx.energyUnit)}`,
        )
      }

      // Average
      const total = logs.reduce((sum, l) => sum + (l.calories as number), 0)
      const avg = Math.round(total / logs.length)
      lines.push('')
      lines.push(`Average: ${formatCalories(avg, ctx.energyUnit)}/day`)

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )

  server.tool(
    'log_calories',
    'Log daily calorie intake for today or a specific date.',
    {
      calories: z.number().int().positive().describe('Calorie count'),
      date: z
        .string()
        .optional()
        .describe('Date in YYYY-MM-DD format. Defaults to today.'),
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
      const dateStr = args.date || getTodayString(tz)

      const { start } = getDayRange(dateStr, tz)

      await db.collection(`users/${user.uid}/calorieLogs`).add({
        calories: args.calories,
        date: start,
      })

      const displayDate = formatDate(start, tz)
      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ Calories logged: ${formatCalories(args.calories, ctx.energyUnit)} on ${displayDate}`,
          },
        ],
      }
    },
  )
}
