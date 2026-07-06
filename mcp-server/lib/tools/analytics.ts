import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMcpUser } from '../auth';
import { getUserContext } from '../user-context';
import { getFirebaseAdmin } from '../firebase-admin';
import { getDaysBackRange, getDateStringFromTimestamp, toDate, getWeekStart } from '../date-utils';
import { formatWeight, formatCalories, formatShortDate } from '../formatters';

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    'get_tdee_analysis',
    'Get your adaptive TDEE (Total Daily Energy Expenditure) calculation, current weight, weight change, and goal tracking information.',
    {
      timezone: z.string().optional().describe('IANA timezone (e.g., "America/New_York"). Defaults to UTC.'),
    },
    async (args, extra) => {
      const user = getMcpUser(extra);
      const ctx = await getUserContext(user.uid);
      const { db } = getFirebaseAdmin();
      const tz = args.timezone || 'UTC';

      // Fetch user doc for TDEE config
      const userDoc = await db.doc(`users/${user.uid}`).get();
      const userData = userDoc.data() || {};
      const tdeeConfig = userData.tdeeConfig as {
        weightUnit?: string;
        energyUnit?: string;
        smoothingWindowWeeks?: number;
        goalWeight?: number;
        goalWeeklyRate?: number;
        gender?: string;
        heightValue?: number;
        measurementUnit?: string;
        waistValue?: number;
        neckValue?: number;
        hipValue?: number;
      } | undefined;

      if (!tdeeConfig) {
        return {
          content: [{
            type: 'text' as const,
            text: '📈 TDEE Analysis\n\nTDEE tracking has not been configured yet. Set up your TDEE preferences in the app first (Analytics > Health & TDEE > Setup).',
          }],
        };
      }

      // Fetch weight and calorie logs (cap to 1 year)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const { Timestamp } = await import('firebase-admin/firestore');
      const cutoff = Timestamp.fromDate(oneYearAgo);

      const [weightSnap, calorieSnap] = await Promise.all([
        db.collection(`users/${user.uid}/weightLogs`)
          .where('date', '>=', cutoff)
          .orderBy('date', 'asc')
          .get(),
        db.collection(`users/${user.uid}/calorieLogs`)
          .where('date', '>=', cutoff)
          .orderBy('date', 'asc')
          .get(),
      ]);

      const weightLogs = weightSnap.docs.map(d => d.data());
      const calorieLogs = calorieSnap.docs.map(d => d.data());

      if (weightLogs.length === 0 && calorieLogs.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: '📈 TDEE Analysis\n\nNo weight or calorie data found. Start logging your daily weight and calories to calculate your TDEE.',
          }],
        };
      }

      // Group logs into weekly buckets (Mon-Sun)
      const allDates: Date[] = [
        ...weightLogs.map(l => toDate(l.date)),
        ...calorieLogs.map(l => toDate(l.date)),
      ];

      const earliest = new Date(Math.min(...allDates.map(d => d.getTime())));
      const latest = new Date(Math.max(...allDates.map(d => d.getTime())));

      // Build weight/calorie maps
      const weightMap = new Map<string, number>();
      for (const log of weightLogs) {
        const d = toDate(log.date);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        weightMap.set(key, log.weight as number);
      }

      const calorieMap = new Map<string, number>();
      for (const log of calorieLogs) {
        const d = toDate(log.date);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        calorieMap.set(key, log.calories as number);
      }

      // Group into weeks
      const startMonday = getWeekStart(earliest);

      interface WeekSummary {
        start: Date;
        end: Date;
        avgWeight: number | null;
        avgCalories: number | null;
        weightDays: number;
        calorieDays: number;
      }

      const weeks: WeekSummary[] = [];
      const currentMonday = new Date(startMonday);

      while (currentMonday <= latest) {
        let weightSum = 0, weightCount = 0;
        let calorieSum = 0, calorieCount = 0;

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const date = new Date(currentMonday);
          date.setDate(date.getDate() + dayOffset);
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

          const w = weightMap.get(key);
          if (w !== undefined) { weightSum += w; weightCount++; }

          const c = calorieMap.get(key);
          if (c !== undefined) { calorieSum += c; calorieCount++; }
        }

        if (weightCount > 0 || calorieCount > 0) {
          const weekEnd = new Date(currentMonday);
          weekEnd.setDate(weekEnd.getDate() + 6);
          weeks.push({
            start: new Date(currentMonday),
            end: weekEnd,
            avgWeight: weightCount > 0 ? weightSum / weightCount : null,
            avgCalories: calorieCount > 0 ? Math.round(calorieSum / calorieCount) : null,
            weightDays: weightCount,
            calorieDays: calorieCount,
          });
        }

        currentMonday.setDate(currentMonday.getDate() + 7);
      }

      // Calculate basic TDEE estimates
      const weeksWithBoth = weeks.filter(w => w.avgWeight !== null && w.avgCalories !== null);
      const energyPerUnit = ctx.weightUnit === 'kg' ? 7716.17 : 3500; // kcal per unit of body weight

      let currentTDEE: number | null = null;
      let totalWeightChange: number | null = null;
      const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight as number : null;
      const startingWeight = weightLogs.length > 0 ? weightLogs[0].weight as number : null;

      if (startingWeight !== null && currentWeight !== null) {
        totalWeightChange = currentWeight - startingWeight;
      }

      // Calculate raw TDEE for weeks with both weight and calorie data
      const rawTDEEs: number[] = [];
      for (let i = 1; i < weeksWithBoth.length; i++) {
        const prev = weeksWithBoth[i - 1];
        const curr = weeksWithBoth[i];
        if (prev.avgWeight !== null && curr.avgWeight !== null && curr.avgCalories !== null) {
          const weightDelta = curr.avgWeight - prev.avgWeight;
          const rawTDEE = curr.avgCalories - (weightDelta * energyPerUnit / 7);
          rawTDEEs.push(rawTDEE);
        }
      }

      if (rawTDEEs.length > 0) {
        // Simple smoothed average (last N weeks)
        const smoothingWindow = tdeeConfig.smoothingWindowWeeks || 12;
        const recentTDEEs = rawTDEEs.slice(-smoothingWindow);
        currentTDEE = Math.round(recentTDEEs.reduce((a, b) => a + b, 0) / recentTDEEs.length);
      } else if (currentWeight !== null) {
        // Seed TDEE
        const seedMultiplier = ctx.weightUnit === 'kg' ? 28.66 : 13;
        currentTDEE = Math.round(currentWeight * seedMultiplier);
      }

      // Round to nearest 25
      const displayTDEE = currentTDEE !== null ? Math.round(currentTDEE / 25) * 25 : null;

      const lines: string[] = [];
      lines.push('📈 TDEE Analysis');
      lines.push('');

      if (displayTDEE !== null) {
        lines.push(`Current TDEE: ${formatCalories(displayTDEE, ctx.energyUnit)}/day`);
      }
      if (currentWeight !== null) {
        lines.push(`Current Weight: ${formatWeight(currentWeight, ctx.weightUnit)}`);
      }
      if (totalWeightChange !== null) {
        const sign = totalWeightChange >= 0 ? '+' : '';
        lines.push(`Weight Change: ${sign}${totalWeightChange.toFixed(1)} ${ctx.weightUnit} (since tracking began)`);
      }
      lines.push(`Weeks of Data: ${weeks.length}`);

      const hasEnoughData = weeksWithBoth.length >= 2;
      if (!hasEnoughData) {
        lines.push('');
        lines.push('ℹ️ Need at least 2 weeks of weight + calorie data for accurate TDEE calculation.');
      }

      // Goal tracking
      if (tdeeConfig.goalWeight !== undefined && displayTDEE !== null) {
        lines.push('');
        lines.push('🎯 Goal:');
        lines.push(`  Target Weight: ${formatWeight(tdeeConfig.goalWeight, ctx.weightUnit)}`);

        if (tdeeConfig.goalWeeklyRate && currentWeight !== null) {
          const weeklyRate = tdeeConfig.goalWeeklyRate;
          const dailyCalorieAdjustment = (weeklyRate * energyPerUnit) / 7;
          const isLosing = tdeeConfig.goalWeight < currentWeight;
          const goalCalories = Math.round(displayTDEE + (isLosing ? -dailyCalorieAdjustment : dailyCalorieAdjustment));
          const dailyDeficit = Math.abs(Math.round(dailyCalorieAdjustment));
          const weightToChange = Math.abs(tdeeConfig.goalWeight - currentWeight);
          const weeksToGoal = Math.ceil(weightToChange / weeklyRate);
          const goalDate = new Date();
          goalDate.setDate(goalDate.getDate() + weeksToGoal * 7);

          lines.push(`  Goal Calories: ${formatCalories(goalCalories, ctx.energyUnit)}/day`);
          lines.push(`  Daily ${isLosing ? 'Deficit' : 'Surplus'}: ${formatCalories(dailyDeficit, ctx.energyUnit)}`);
          lines.push(`  Weeks to Goal: ${weeksToGoal}`);
          lines.push(`  Estimated Date: ${formatShortDate(goalDate, tz, true)}`);
        }
      }

      // Weekly breakdown (last 4 weeks)
      if (weeks.length > 0) {
        lines.push('');
        lines.push('📊 Weekly Breakdown (Recent):');
        const recentWeeks = weeks.slice(-4);
        for (const week of recentWeeks) {
          const startStr = week.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endStr = week.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const parts: string[] = [`${startStr} - ${endStr}:`];
          if (week.avgWeight !== null) {
            parts.push(`Avg Weight ${formatWeight(Math.round(week.avgWeight * 10) / 10, ctx.weightUnit)}`);
          }
          if (week.avgCalories !== null) {
            parts.push(`Avg Calories ${formatCalories(week.avgCalories, ctx.energyUnit)}`);
          }
          lines.push(`  ${parts.join(' | ')}`);
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );

  server.tool(
    'get_exercise_trends',
    'Get historical performance trends for a specific exercise, showing average weight and reps per session.',
    {
      exercise_name: z.string().describe('Exercise name to analyze'),
      timezone: z.string().optional().describe('IANA timezone (e.g., "America/New_York"). Defaults to UTC.'),
    },
    async (args, extra) => {
      const user = getMcpUser(extra);
      const ctx = await getUserContext(user.uid);
      const { db } = getFirebaseAdmin();
      const tz = args.timezone || 'UTC';
      const { start, end } = getDaysBackRange(90, tz);

      const snap = await db.collection(`users/${user.uid}/history`)
        .where('date', '>=', start)
        .where('date', '<', end)
        .orderBy('date', 'asc')
        .get();

      const filterName = args.exercise_name.toLowerCase();
      const filtered = snap.docs
        .map(d => d.data())
        .filter(s => (s.exerciseName as string).toLowerCase().includes(filterName));

      if (filtered.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `📈 Exercise Trends: ${args.exercise_name}\n\nNo data found for this exercise in the last 90 days.`,
          }],
        };
      }

      // Group by date to get per-session averages
      const sessionMap = new Map<string, { totalWeight: number; totalReps: number; count: number }>();
      for (const s of filtered) {
        const dateStr = getDateStringFromTimestamp(s.date as FirebaseFirestore.Timestamp, tz);
        const existing = sessionMap.get(dateStr) || { totalWeight: 0, totalReps: 0, count: 0 };
        existing.totalWeight += s.weight as number;
        existing.totalReps += s.reps as number;
        existing.count++;
        sessionMap.set(dateStr, existing);
      }

      const sessions = Array.from(sessionMap.entries())
        .map(([dateStr, data]) => ({
          dateStr,
          avgWeight: Math.round((data.totalWeight / data.count) * 10) / 10,
          avgReps: Math.round((data.totalReps / data.count) * 10) / 10,
          setCount: data.count,
        }))
        .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      // Use the exercise name from the first matching record
      const exerciseDisplayName = filtered[0].exerciseName as string;

      const lines: string[] = [];
      lines.push(`📈 Exercise Trends: ${exerciseDisplayName}`);
      lines.push('');

      const recentSessions = sessions.slice(-10);
      lines.push(`Session History (Last ${recentSessions.length}):`);
      for (const s of recentSessions.reverse()) {
        const [y, m, d] = s.dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        lines.push(`  ${dateLabel}: ${s.setCount} sets — Avg ${formatWeight(s.avgWeight, ctx.weightUnit)} × ${s.avgReps} reps`);
      }

      // Progress summary
      if (sessions.length >= 2) {
        const first = sessions[0];
        const last = sessions[sessions.length - 1];
        const delta = last.avgWeight - first.avgWeight;
        const sign = delta >= 0 ? '+' : '';
        lines.push('');
        lines.push(`Progress: ${formatWeight(first.avgWeight, ctx.weightUnit)} → ${formatWeight(last.avgWeight, ctx.weightUnit)} (${sign}${delta.toFixed(1)} ${ctx.weightUnit} over ${sessions.length} sessions)`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }
  );
}
