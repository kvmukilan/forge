import { Habit, CoinTransaction, TransactionType } from './types'
import { DateTime } from 'luxon'
import { getBestStreak, getCompletionRate30Days } from './gamification'

export function getYearlyCompletionMap(habits: Habit[], timezone: string): Map<string, number> {
  const map = new Map<string, number>()
  const nonTaskHabits = habits.filter(h => !h.isTask && !h.archived)
  for (const habit of nonTaskHabits) {
    for (const c of habit.completions) {
      const day = DateTime.fromISO(c).setZone(timezone).toISODate()
      if (day) map.set(day, (map.get(day) ?? 0) + 1)
    }
  }
  return map
}

export function getDayOfWeekStats(habits: Habit[], timezone: string): { day: string; avg: number }[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const counts = [0, 0, 0, 0, 0, 0, 0]
  const totals = [0, 0, 0, 0, 0, 0, 0]
  const nonTaskHabits = habits.filter(h => !h.isTask && !h.archived)

  // Get all unique days that have any completion
  const allDays = new Set<string>()
  for (const habit of nonTaskHabits) {
    for (const c of habit.completions) {
      const day = DateTime.fromISO(c).setZone(timezone).toISODate()
      if (day) allDays.add(day)
    }
  }

  // For each day in data range, count completions per weekday
  for (const dayStr of allDays) {
    const dt = DateTime.fromISO(dayStr, { zone: timezone })
    const weekday = dt.weekday - 1 // 0=Mon, 6=Sun
    totals[weekday]++
    // count how many habits were completed on this day
    let completedCount = 0
    for (const habit of nonTaskHabits) {
      const target = habit.targetCompletions ?? 1
      const dayCompletions = habit.completions.filter(c =>
        DateTime.fromISO(c).setZone(timezone).toISODate() === dayStr
      ).length
      if (dayCompletions >= target) completedCount++
    }
    counts[weekday] += completedCount
  }

  return days.map((day, i) => ({
    day,
    avg: totals[i] > 0 ? Math.round((counts[i] / totals[i] / Math.max(1, nonTaskHabits.length)) * 100) : 0,
  }))
}

export function getPerHabitStats(habits: Habit[], timezone: string) {
  return habits
    .filter(h => !h.isTask && !h.archived)
    .map(habit => ({
      habit,
      total: habit.completions.length,
      bestStreak: getBestStreak(habit, timezone),
      rate30d: getCompletionRate30Days(habit, timezone),
    }))
    .sort((a, b) => b.total - a.total)
}

export function getCoinBreakdown(transactions: CoinTransaction[]) {
  const byType: Partial<Record<TransactionType, number>> = {}
  let earned = 0
  let spent = 0
  for (const t of transactions) {
    byType[t.type] = (byType[t.type] ?? 0) + t.amount
    if (t.amount > 0) earned += t.amount
    else spent += Math.abs(t.amount)
  }
  return { earned, spent, byType }
}

export function getHabitCorrelations(habits: Habit[], timezone: string) {
  const nonTaskHabits = habits.filter(h => !h.isTask && !h.archived)
  if (nonTaskHabits.length < 2) return []

  // Build a map: day -> Set of habit IDs completed that day
  const dayMap = new Map<string, Set<string>>()
  for (const habit of nonTaskHabits) {
    for (const c of habit.completions) {
      const day = DateTime.fromISO(c).setZone(timezone).toISODate()
      if (!day) continue
      if (!dayMap.has(day)) dayMap.set(day, new Set())
      dayMap.get(day)!.add(habit.id)
    }
  }

  const correlations: { habitAId: string; habitAName: string; habitBId: string; habitBName: string; pct: number; coOccurrences: number }[] = []

  for (let i = 0; i < nonTaskHabits.length; i++) {
    for (let j = i + 1; j < nonTaskHabits.length; j++) {
      const a = nonTaskHabits[i]
      const b = nonTaskHabits[j]
      let coOccurrences = 0
      let eitherOccurrences = 0
      for (const daySet of dayMap.values()) {
        const hasA = daySet.has(a.id)
        const hasB = daySet.has(b.id)
        if (hasA || hasB) eitherOccurrences++
        if (hasA && hasB) coOccurrences++
      }
      if (coOccurrences >= 5 && eitherOccurrences > 0) {
        correlations.push({
          habitAId: a.id, habitAName: a.name,
          habitBId: b.id, habitBName: b.name,
          pct: Math.round((coOccurrences / eitherOccurrences) * 100),
          coOccurrences,
        })
      }
    }
  }

  return correlations.sort((a, b) => b.pct - a.pct).slice(0, 10)
}
