import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMcpUser } from '../auth';
import { getUserContext } from '../user-context';
import { getFirebaseAdmin } from '../firebase-admin';
import { getDayRange, getTodayString, getDateStringFromTimestamp } from '../date-utils';
import { formatDate, formatWeight, formatCalories, formatVolume } from '../formatters';

export function registerSummaryTools(server: McpServer) {
  server.tool(
    'get_daily_summary',
    'Get a complete snapshot of a day\'s activity including workouts, weight, calories, journal entries, and supplements.',
    {
      date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today in your timezone.'),
      timezone: z.string().optional().describe('IANA timezone (e.g., "America/New_York", "Asia/Kolkata"). Defaults to UTC.'),
    },
    async (args, extra) => {
      const user = getMcpUser(extra);
      const ctx = await getUserContext(user.uid);
      const { db } = getFirebaseAdmin();
      const tz = args.timezone || 'UTC';
      const dateStr = args.date || getTodayString(tz);
      const { start, end } = getDayRange(dateStr, tz);

      // Fetch all data for the day in parallel
      const [historySnap, weightSnap, calorieSnap, journalSnap] = await Promise.all([
        db.collection(`users/${user.uid}/history`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .orderBy('date', 'asc')
          .get(),
        db.collection(`users/${user.uid}/weightLogs`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .get(),
        db.collection(`users/${user.uid}/calorieLogs`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .get(),
        db.collection(`users/${user.uid}/journalEntries`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .get(),
      ]);

      const lines: string[] = [];
      const displayDate = formatDate(start, tz);
      lines.push(`📅 Daily Summary for ${displayDate}`);
      lines.push('');

      // Workouts
      if (historySnap.empty) {
        lines.push('🏋️ Workouts: No sets logged');
      } else {
        const sets = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Group by exercise
        const exerciseGroups: Record<string, { name: string; sets: Array<{ set: number; reps: number; weight: number; date: unknown }> }> = {};
        let totalVolume = 0;

        for (const s of sets) {
          const data = s as Record<string, unknown>;
          const exerciseName = data.exerciseName as string;
          const reps = data.reps as number;
          const weight = data.weight as number;
          const setNum = data.set as number;

          if (!exerciseGroups[exerciseName]) {
            exerciseGroups[exerciseName] = { name: exerciseName, sets: [] };
          }
          exerciseGroups[exerciseName].sets.push({ set: setNum, reps, weight, date: data.date });
          totalVolume += reps * weight;
        }

        lines.push(`🏋️ Workouts (${sets.length} sets completed):`);
        for (const [, group] of Object.entries(exerciseGroups)) {
          lines.push(`  ${group.name}: ${group.sets.length} sets`);
          for (const s of group.sets.sort((a, b) => a.set - b.set)) {
            lines.push(`    Set ${s.set}: ${s.reps} reps @ ${formatWeight(s.weight, ctx.weightUnit)}`);
          }
        }
        lines.push(`  Total Volume: ${formatVolume(totalVolume)} ${ctx.weightUnit}`);
      }
      lines.push('');

      // Weight
      if (weightSnap.empty) {
        lines.push('⚖️ Body Weight: Not logged');
      } else {
        const w = weightSnap.docs[0].data();
        lines.push(`⚖️ Body Weight: ${formatWeight(w.weight as number, ctx.weightUnit)}`);
      }

      // Calories
      if (calorieSnap.empty) {
        lines.push('🔥 Calories: Not logged');
      } else {
        const c = calorieSnap.docs[0].data();
        lines.push(`🔥 Calories: ${formatCalories(c.calories as number, ctx.energyUnit)}`);
      }
      lines.push('');

      // Journal
      if (journalSnap.empty) {
        lines.push('📓 Journal: No entry');
      } else {
        for (const doc of journalSnap.docs) {
          const j = doc.data();
          if (j.note) {
            lines.push(`📓 Journal: "${j.note}"`);
          }
          const supplements = j.supplements as Array<{ name: string; dosage?: string }> | undefined;
          if (supplements && supplements.length > 0) {
            const suppStr = supplements.map(s => s.dosage ? `${s.name} (${s.dosage})` : s.name).join(', ');
            lines.push(`💊 Supplements: ${suppStr}`);
          }
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  server.tool(
    'get_weekly_summary',
    'Get a week-level overview with workout volume, frequency, weight trend, and calorie averages.',
    {
      week_offset: z.number().optional().describe('0 = current week, -1 = last week, -2 = two weeks ago, etc. Default: 0'),
      timezone: z.string().optional().describe('IANA timezone (e.g., "America/New_York", "Asia/Kolkata"). Defaults to UTC.'),
    },
    async (args, extra) => {
      const user = getMcpUser(extra);
      const ctx = await getUserContext(user.uid);
      const { db } = getFirebaseAdmin();
      const tz = args.timezone || 'UTC';

      const offset = args.week_offset ?? 0;
      // Calculate week range
      const todayStr = getTodayString(tz);
      const [y, m, d] = todayStr.split('-').map(Number);
      const today = new Date(y, m - 1, d);
      today.setDate(today.getDate() + offset * 7);

      // Get Monday of this week
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(monday.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      const nextMondayDate = new Date(monday);
      nextMondayDate.setDate(nextMondayDate.getDate() + 7);
      const nextMondayStr = `${nextMondayDate.getFullYear()}-${String(nextMondayDate.getMonth() + 1).padStart(2, '0')}-${String(nextMondayDate.getDate()).padStart(2, '0')}`;

      const { start } = getDayRange(mondayStr, tz);
      const { start: end } = getDayRange(nextMondayStr, tz);

      const [historySnap, weightSnap, calorieSnap] = await Promise.all([
        db.collection(`users/${user.uid}/history`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .orderBy('date', 'asc')
          .get(),
        db.collection(`users/${user.uid}/weightLogs`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .orderBy('date', 'asc')
          .get(),
        db.collection(`users/${user.uid}/calorieLogs`)
          .where('date', '>=', start)
          .where('date', '<', end)
          .orderBy('date', 'asc')
          .get(),
      ]);

      const lines: string[] = [];
      const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      lines.push(`📅 Weekly Summary: ${weekLabel}`);
      lines.push('');

      // Workouts
      const workoutSets = historySnap.docs.map(d => d.data());
      const workoutDays = new Set<string>();
      let totalVolume = 0;
      for (const s of workoutSets) {
        const dateKey = getDateStringFromTimestamp(s.date, tz);
        workoutDays.add(dateKey);
        totalVolume += (s.reps as number) * (s.weight as number);
      }

      lines.push('🏋️ Workouts:');
      lines.push(`  Days trained: ${workoutDays.size}/7`);
      lines.push(`  Total sets: ${workoutSets.length}`);
      lines.push(`  Total volume: ${formatVolume(totalVolume)} ${ctx.weightUnit}`);
      lines.push('');

      // Weight
      const weights = weightSnap.docs.map(d => d.data());
      lines.push('⚖️ Weight:');
      if (weights.length === 0) {
        lines.push('  No entries logged');
      } else {
        const first = weights[0].weight as number;
        const last = weights[weights.length - 1].weight as number;
        const delta = last - first;
        const sign = delta >= 0 ? '+' : '';
        lines.push(`  Start: ${formatWeight(first, ctx.weightUnit)} → End: ${formatWeight(last, ctx.weightUnit)} (Δ ${sign}${delta.toFixed(1)} ${ctx.weightUnit})`);
        lines.push(`  Entries logged: ${weights.length}`);
      }
      lines.push('');

      // Calories
      const calories = calorieSnap.docs.map(d => d.data());
      lines.push('🔥 Calories:');
      if (calories.length === 0) {
        lines.push('  No entries logged');
      } else {
        const total = calories.reduce((sum, c) => sum + (c.calories as number), 0);
        const avg = Math.round(total / calories.length);
        lines.push(`  Average: ${formatCalories(avg, ctx.energyUnit)}/day`);
        lines.push(`  Entries logged: ${calories.length}`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );
}
