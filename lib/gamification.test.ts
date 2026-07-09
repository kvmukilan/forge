import { describe, expect, test } from 'bun:test'
import { DateTime } from 'luxon'
import { calculateStreak } from './gamification'
import { getCurrentSeason, getSeasonForMonth, getSeasonTimeline } from './seasons'
import type { Habit } from './types'

const TZ = 'UTC'

function habitWithCompletions(daysAgo: number[]): Habit {
  const now = DateTime.now().setZone(TZ)
  return {
    id: 'h1',
    name: 'Test habit',
    description: '',
    frequency: 'FREQ=DAILY',
    coinReward: 1,
    completions: daysAgo.map(d => now.minus({ days: d }).set({ hour: 10 }).toUTC().toISO()!),
  }
}

function isoDaysAgo(d: number): string {
  return DateTime.now().setZone(TZ).minus({ days: d }).toISODate()!
}

describe('calculateStreak with shields', () => {
  test('unshielded gap breaks the streak', () => {
    // completed yesterday and 3 days ago; missed 2 days ago
    const habit = habitWithCompletions([1, 3])
    expect(calculateStreak(habit, TZ)).toBe(1)
  })

  test('a shield on the missed day preserves the streak', () => {
    const habit = habitWithCompletions([1, 3])
    expect(calculateStreak(habit, TZ, [isoDaysAgo(2)])).toBe(2)
  })

  test('shielded day itself adds no count', () => {
    const habit = habitWithCompletions([1, 2, 4])
    // gap at day 3 shielded -> 1,2 counted + 4 counted = 3
    expect(calculateStreak(habit, TZ, [isoDaysAgo(3)])).toBe(3)
  })

  test('two consecutive missed days need two shields', () => {
    const habit = habitWithCompletions([1, 4])
    expect(calculateStreak(habit, TZ, [isoDaysAgo(2)])).toBe(1)
    expect(calculateStreak(habit, TZ, [isoDaysAgo(2), isoDaysAgo(3)])).toBe(2)
  })

  test('today incomplete still gets grace', () => {
    const habit = habitWithCompletions([1, 2])
    expect(calculateStreak(habit, TZ)).toBe(2)
  })
})

describe('rolling seasons', () => {
  test('a season exists for every month over the next 24 months', () => {
    const now = new Date()
    for (let offset = 0; offset < 24; offset++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 15))
      const season = getCurrentSeason(d)
      expect(season).not.toBeNull()
      expect(season.startDate <= d.toISOString().slice(0, 10)).toBe(true)
      expect(season.endDate >= d.toISOString().slice(0, 10)).toBe(true)
    }
  })

  test('season numbering is stable and monotonic', () => {
    expect(getSeasonForMonth(2025, 1).number).toBe(1)
    expect(getSeasonForMonth(2026, 7).number).toBe(19)
    expect(getSeasonForMonth(2026, 8).number).toBe(20)
  })

  test('timeline contains the current season', () => {
    const timeline = getSeasonTimeline()
    const current = getCurrentSeason()
    expect(timeline.some(s => s.id === current.id)).toBe(true)
  })

  test('february end date is correct in leap years', () => {
    expect(getSeasonForMonth(2028, 2).endDate).toBe('2028-02-29')
    expect(getSeasonForMonth(2026, 2).endDate).toBe('2026-02-28')
  })
})
