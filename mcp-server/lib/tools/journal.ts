import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpUser } from '../auth'
import { getUserContext } from '../user-context'
import { getFirebaseClient } from '../firebase-client'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
} from 'firebase/firestore'
import {
  getDaysBackRange,
  getDayRange,
  getTodayString,
  getDateStringFromTimestamp,
} from '../date-utils'
import { formatDate, formatWeight, formatCalories } from '../formatters'

export function registerJournalTools(server: McpServer) {
  server.tool(
    'get_journal_entries',
    'View journal entries with supplement tracking. Shows cross-referenced weight and calorie data for each day.',
    {
      days_back: z
        .number()
        .min(1)
        .max(90)
        .optional()
        .describe('Number of days of history. Default: 14'),
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
      const daysBack = args.days_back ?? 14
      const { start, end } = getDaysBackRange(daysBack, tz)

      // Fetch journal entries, weight logs, and calorie logs in parallel
      const [journalSnap, weightSnap, calorieSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, `users/${user.uid}/journalEntries`),
            where('date', '>=', start),
            where('date', '<', end),
            orderBy('date', 'desc'),
          ),
        ),
        getDocs(
          query(
            collection(db, `users/${user.uid}/weightLogs`),
            where('date', '>=', start),
            where('date', '<', end),
          ),
        ),
        getDocs(
          query(
            collection(db, `users/${user.uid}/calorieLogs`),
            where('date', '>=', start),
            where('date', '<', end),
          ),
        ),
      ])

      if (journalSnap.empty) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `📓 Journal Entries (Last ${daysBack} Days)\n\nNo journal entries found.`,
            },
          ],
        }
      }

      // Build weight and calorie lookups by date
      const weightByDate: Record<string, number> = {}
      for (const doc of weightSnap.docs) {
        const d = doc.data()
        const dateKey = getDateStringFromTimestamp(d.date, tz)
        if (weightByDate[dateKey] === undefined) {
          weightByDate[dateKey] = d.weight as number
        }
      }

      const calorieByDate: Record<string, number> = {}
      for (const doc of calorieSnap.docs) {
        const d = doc.data()
        const dateKey = getDateStringFromTimestamp(d.date, tz)
        if (calorieByDate[dateKey] === undefined) {
          calorieByDate[dateKey] = d.calories as number
        }
      }

      const lines: string[] = []
      lines.push(`📓 Journal Entries (Last ${daysBack} Days)`)
      lines.push('')

      for (const doc of journalSnap.docs) {
        const entry = doc.data()
        const dateKey = getDateStringFromTimestamp(entry.date, tz)
        const displayDate = formatDate(entry.date, tz)

        // Build header with cross-referenced data
        const badges: string[] = []
        if (weightByDate[dateKey] !== undefined) {
          badges.push(
            `⚖️ ${formatWeight(weightByDate[dateKey], ctx.weightUnit)}`,
          )
        }
        if (calorieByDate[dateKey] !== undefined) {
          badges.push(
            `🔥 ${formatCalories(calorieByDate[dateKey], ctx.energyUnit)}`,
          )
        }

        const header =
          badges.length > 0
            ? `${displayDate} — ${badges.join(' | ')}`
            : displayDate
        lines.push(header)

        if (entry.note) {
          lines.push(`  "${entry.note}"`)
        }

        const supplements = entry.supplements as
          | Array<{ name: string; dosage?: string }>
          | undefined
        if (supplements && supplements.length > 0) {
          const suppStr = supplements
            .map((s) => (s.dosage ? `${s.name} (${s.dosage})` : s.name))
            .join(', ')
          lines.push(`  💊 ${suppStr}`)
        }

        lines.push('')
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n').trimEnd() }],
      }
    },
  )

  server.tool(
    'log_journal_entry',
    'Create a new journal entry with optional supplement tracking.',
    {
      note: z.string().describe('Journal note text'),
      supplements: z
        .array(
          z.object({
            name: z.string().describe('Supplement name'),
            dosage: z
              .string()
              .optional()
              .describe('Dosage (e.g., "5g", "1 capsule")'),
          }),
        )
        .optional()
        .describe('Array of supplements taken'),
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
      const { db } = getFirebaseClient()
      const tz = args.timezone || 'UTC'
      const dateStr = args.date || getTodayString(tz)

      const { start } = getDayRange(dateStr, tz)

      const entryData: Record<string, unknown> = {
        note: args.note,
        date: start,
        supplements: args.supplements || [],
      }

      await addDoc(collection(db, `users/${user.uid}/journalEntries`), entryData)

      const displayDate = formatDate(start, tz)
      let confirmation = `✅ Journal entry saved for ${displayDate}`
      if (args.supplements && args.supplements.length > 0) {
        const suppStr = args.supplements
          .map((s) => (s.dosage ? `${s.name} (${s.dosage})` : s.name))
          .join(', ')
        confirmation += `\n💊 Supplements: ${suppStr}`
      }

      return { content: [{ type: 'text' as const, text: confirmation }] }
    },
  )
}
