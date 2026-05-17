import { DateTime } from 'luxon'
import { Habit, XPData, Boss } from '@/lib/types'

// --- XP Calculations ---
export function calculateHabitXP(habit: Habit): number {
  const multipliers: Record<string, number> = { easy: 1, medium: 1.5, hard: 2 }
  const multiplier = multipliers[habit.difficulty ?? 'medium'] ?? 1.5
  return Math.round(habit.coinReward * multiplier)
}

export function cumulativeXPRequired(level: number): number {
  return 50 * level * (level + 1)
}

export function getLevelFromXP(totalXP: number): number {
  let level = 0
  while (level < 50 && totalXP >= cumulativeXPRequired(level + 1)) level++
  return Math.max(1, level)
}

export function xpForCurrentLevel(totalXP: number): number {
  const lvl = getLevelFromXP(totalXP)
  const base = lvl > 1 ? cumulativeXPRequired(lvl - 1) : 0
  return totalXP - base
}

export function xpRequiredForNextLevel(totalXP: number): number {
  const lvl = getLevelFromXP(totalXP)
  if (lvl >= 50) return 0
  const base = lvl > 1 ? cumulativeXPRequired(lvl - 1) : 0
  return cumulativeXPRequired(lvl) - base
}

export function getXPProgress(totalXP: number): { current: number; needed: number; pct: number; level: number } {
  const level = getLevelFromXP(totalXP)
  const current = xpForCurrentLevel(totalXP)
  const needed = xpRequiredForNextLevel(totalXP)
  const pct = needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 100
  return { current, needed, pct, level }
}

// --- Streak Calculation ---
export function calculateStreak(habit: Habit, timezone: string): number {
  if (habit.isTask || habit.archived || !habit.completions.length) return 0

  const target = habit.targetCompletions ?? 1

  // Count completions per day
  const countsByDay = new Map<string, number>()
  for (const completion of habit.completions) {
    const dateStr = DateTime.fromISO(completion).setZone(timezone).toISODate()!
    countsByDay.set(dateStr, (countsByDay.get(dateStr) ?? 0) + 1)
  }

  // Build set of fully-completed days
  const fullyCompleted = new Set<string>()
  for (const [day, count] of countsByDay.entries()) {
    if (count >= target) fullyCompleted.add(day)
  }

  // Walk backwards from today
  let streak = 0
  let cursor = DateTime.now().setZone(timezone)

  // If today not completed, check yesterday (give grace for today)
  const todayStr = cursor.toISODate()!
  if (!fullyCompleted.has(todayStr)) {
    cursor = cursor.minus({ days: 1 })
  }

  while (streak < 10000) {
    const dateStr = cursor.toISODate()!
    if (fullyCompleted.has(dateStr)) {
      streak++
      cursor = cursor.minus({ days: 1 })
    } else {
      break
    }
  }

  return streak
}

export function getMaxStreak(habits: Habit[], timezone: string): number {
  return Math.max(0, ...habits.filter(h => !h.isTask && !h.archived).map(h => calculateStreak(h, timezone)))
}

// --- Daily Challenge ---
export type DailyChallengeType = 'complete_n_habits' | 'earn_n_coins' | 'complete_all_due'

export type DailyChallenge = {
  id: string
  type: DailyChallengeType
  target: number
  bonusXP: number
  label: string
  dateStr: string
}

export function generateDailyChallenge(dateStr: string): DailyChallenge {
  const seed = dateStr.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0)

  const challenges: { type: DailyChallengeType; targets: number[]; label: (n: number) => string }[] = [
    { type: 'complete_n_habits', targets: [3, 4, 5], label: (n) => `Complete ${n} habits today` },
    { type: 'earn_n_coins', targets: [20, 30, 50], label: (n) => `Earn ${n} coins today` },
    { type: 'complete_n_habits', targets: [2, 3, 4], label: (n) => `Finish ${n} tasks or habits` },
  ]

  const typeIdx = seed % challenges.length
  const chosen = challenges[typeIdx]
  const targetIdx = (seed >> 2) % chosen.targets.length
  const target = chosen.targets[targetIdx]

  return {
    id: `daily-${dateStr}`,
    type: chosen.type,
    target,
    bonusXP: 50,
    label: chosen.label(target),
    dateStr,
  }
}

// --- Achievement Definitions ---
export type AchievementCheckData = {
  habits: Habit[]
  maxStreak: number
  level: number
  totalEarned: number
  hasRedeemedWishlist: boolean
}

export type AchievementDef = {
  id: string
  name: string
  description: string
  iconName: string
  iconColor: string
  check: (data: AchievementCheckData) => boolean
}

// --- Streak Milestones ---
export const STREAK_MILESTONES = [
  { days: 3,   coins: 25,   label: '🔥 On a Roll',       emoji: '🔥' },
  { days: 7,   coins: 75,   label: '🏅 Week Warrior',     emoji: '🏅' },
  { days: 14,  coins: 150,  label: '⚡ Two Weeks Strong',  emoji: '⚡' },
  { days: 21,  coins: 200,  label: '🌟 Habit Forming',    emoji: '🌟' },
  { days: 30,  coins: 300,  label: '💎 Monthly Master',   emoji: '💎' },
  { days: 100, coins: 1000, label: '👑 Century Club',     emoji: '👑' },
] as const

export type StreakMilestone = typeof STREAK_MILESTONES[number]

export function getStreakMilestone(streak: number): StreakMilestone | null {
  return STREAK_MILESTONES.find(m => m.days === streak) ?? null
}

// --- Variable Gem Drop ---
export function rollForGemDrop(hasGemBoost = false): boolean {
  const chance = hasGemBoost ? 0.30 : 0.15
  return Math.random() < chance
}

// --- Boss Battle ---
export const BOSS_NAMES = [
  { name: 'Monday Malaise',       emoji: '😴' },
  { name: 'The Procrastinator',   emoji: '⏰' },
  { name: 'Comfort Zone Titan',   emoji: '🛋️' },
  { name: 'The Distractor',       emoji: '📱' },
  { name: 'Shadow of Laziness',   emoji: '👤' },
  { name: 'Screen Time Monster',  emoji: '🖥️' },
  { name: 'Chaos Lord',           emoji: '🌪️' },
  { name: 'The Snooze Demon',     emoji: '💤' },
]

export function spawnWeeklyBoss(weekStart: string, habitCount: number): Boss {
  const seed = weekStart.split('-').reduce((a, n) => a + parseInt(n, 10), 0)
  const bossTemplate = BOSS_NAMES[seed % BOSS_NAMES.length]
  const maxHP = Math.max(50, habitCount * 10)
  return {
    id: `boss-${weekStart}`,
    name: bossTemplate.name,
    emoji: bossTemplate.emoji,
    weekStart,
    maxHP,
    currentHP: maxHP,
    isDefeated: false,
    reward: { xp: 500, coins: 200 },
  }
}

export function getBossCountdownMs(weekStart: string, timezone: string): number {
  const start = DateTime.fromISO(weekStart, { zone: timezone })
  const end = start.plus({ days: 7 })
  return Math.max(0, end.toMillis() - DateTime.now().setZone(timezone).toMillis())
}

export function formatCountdown(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const days = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// --- Weekly Habit DNA ---
export interface HabitDNAData {
  bestHabit: string | null
  weakestHabit: string | null
  weekdayPct: number
  weekendPct: number
  perHabit: { name: string; pct: number; streak: number }[]
  insight: string
}

export function computeWeeklyDNA(habits: Habit[], timezone: string): HabitDNAData {
  const now = DateTime.now().setZone(timezone)
  const weekAgo = now.minus({ days: 7 })
  const nonTasks = habits.filter(h => !h.isTask && !h.archived)

  const perHabit = nonTasks.map(h => {
    const completionsThisWeek = h.completions.filter(c => {
      const d = DateTime.fromISO(c).setZone(timezone)
      return d >= weekAgo && d <= now
    }).length
    const daysScheduled = 7
    const pct = Math.round((completionsThisWeek / daysScheduled) * 100)
    return { name: h.name, pct, streak: calculateStreak(h, timezone) }
  })

  const sorted = [...perHabit].sort((a, b) => b.pct - a.pct)
  const bestHabit = sorted[0]?.name ?? null
  const weakestHabit = sorted[sorted.length - 1]?.name ?? null

  // Weekday vs weekend
  const weekdayCompletions = habits.flatMap(h => h.completions).filter(c => {
    const d = DateTime.fromISO(c).setZone(timezone)
    return d >= weekAgo && [1, 2, 3, 4, 5].includes(d.weekday)
  }).length
  const weekendCompletions = habits.flatMap(h => h.completions).filter(c => {
    const d = DateTime.fromISO(c).setZone(timezone)
    return d >= weekAgo && [6, 7].includes(d.weekday)
  }).length
  const weekdayPct = weekdayCompletions + weekendCompletions > 0
    ? Math.round((weekdayCompletions / (weekdayCompletions + weekendCompletions)) * 100)
    : 0
  const weekendPct = 100 - weekdayPct

  const avgPct = perHabit.length > 0 ? Math.round(perHabit.reduce((s, h) => s + h.pct, 0) / perHabit.length) : 0
  const insight = avgPct >= 80 ? "Incredible week — you're unstoppable! 🚀"
    : avgPct >= 60 ? "Solid week. Push a bit harder on the weekend."
    : avgPct >= 40 ? "Keep building. Consistency is the key."
    : "Rough week — but you showed up. That counts."

  return { bestHabit, weakestHabit, weekdayPct, weekendPct, perHabit, insight }
}

// --- Title Definitions ---
export type TitleDef = {
  id: string
  title: string
  description: string
  emoji: string
  check: (data: TitleCheckData) => boolean
}

export type TitleCheckData = {
  maxStreak: number
  shieldsUsed: number
  perfectDays: number
  gems: number
  bossesDefeated: number
  coinBalance: number
  seasonHabitsCompleted?: number
}

export const TITLE_DEFINITIONS: TitleDef[] = [
  { id: 'consistent',   title: 'The Consistent',  emoji: '⚡', description: '30+ day streak on any habit', check: d => d.maxStreak >= 30 },
  { id: 'iron_will',    title: 'Iron Will',        emoji: '🛡️', description: 'Never used a streak shield',  check: d => d.shieldsUsed === 0 && d.maxStreak >= 7 },
  { id: 'perfect_week', title: 'Perfect Week',     emoji: '🌟', description: '7 consecutive perfect days',  check: d => d.perfectDays >= 7 },
  { id: 'gem_hunter',   title: 'Gem Hunter',       emoji: '💎', description: 'Collected 10 gems',           check: d => d.gems >= 10 },
  { id: 'boss_slayer',  title: 'Boss Slayer',      emoji: '⚔️', description: 'Defeated 4 weekly bosses',   check: d => d.bossesDefeated >= 4 },
  { id: 'coin_hoarder', title: 'Coin Hoarder',     emoji: '🪙', description: 'Coin balance over 500',       check: d => d.coinBalance >= 500 },
  { id: 'century_club', title: 'Century Club',     emoji: '👑', description: '100-day streak',              check: d => d.maxStreak >= 100 },
  {
    id: 'season_2_veteran',
    title: 'Shadow Operative',
    emoji: '🌑',
    description: 'Complete 50+ habits during Season 2: Shadow Protocol',
    check: (data: TitleCheckData) => (data.seasonHabitsCompleted ?? 0) >= 50,
  },
]

export function getBestStreak(habit: Habit, timezone: string): number {
  if (habit.isTask || !habit.completions.length) return 0
  const target = habit.targetCompletions ?? 1
  const countsByDay = new Map<string, number>()
  for (const c of habit.completions) {
    const d = DateTime.fromISO(c).setZone(timezone).toISODate()!
    countsByDay.set(d, (countsByDay.get(d) ?? 0) + 1)
  }
  const sortedDays = [...countsByDay.entries()]
    .filter(([, count]) => count >= target)
    .map(([day]) => day)
    .sort()
  let best = 0, current = 0
  let prev: DateTime | null = null
  for (const dayStr of sortedDays) {
    const d = DateTime.fromISO(dayStr, { zone: timezone })
    if (prev && d.diff(prev, 'days').days === 1) {
      current++
    } else {
      current = 1
    }
    best = Math.max(best, current)
    prev = d
  }
  return best
}

export function getCompletionRate30Days(habit: Habit, timezone: string): number {
  if (habit.isTask) return 0
  const now = DateTime.now().setZone(timezone)
  const thirtyDaysAgo = now.minus({ days: 30 })
  const target = habit.targetCompletions ?? 1
  const countsByDay = new Map<string, number>()
  for (const c of habit.completions) {
    const d = DateTime.fromISO(c).setZone(timezone)
    if (d >= thirtyDaysAgo) {
      const key = d.toISODate()!
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1)
    }
  }
  let completedDays = 0
  for (const count of countsByDay.values()) {
    if (count >= target) completedDays++
  }
  return Math.round((completedDays / 30) * 100)
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  {
    id: 'first_habit',
    name: 'First Steps',
    description: 'Create your first habit',
    iconName: 'Target',
    iconColor: 'text-blue-400',
    check: (d) => d.habits.length >= 1,
  },
  {
    id: 'first_complete',
    name: 'Getting Started',
    description: 'Complete any habit once',
    iconName: 'CheckCircle',
    iconColor: 'text-green-400',
    check: (d) => d.habits.some(h => h.completions.length > 0),
  },
  {
    id: 'streak_3',
    name: 'On a Roll',
    description: 'Reach a 3-day streak',
    iconName: 'Flame',
    iconColor: 'text-orange-400',
    check: (d) => d.maxStreak >= 3,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Keep a habit for 7 days straight',
    iconName: 'Flame',
    iconColor: 'text-orange-500',
    check: (d) => d.maxStreak >= 7,
  },
  {
    id: 'streak_30',
    name: 'Unstoppable',
    description: 'Reach a 30-day streak',
    iconName: 'Zap',
    iconColor: 'text-yellow-400',
    check: (d) => d.maxStreak >= 30,
  },
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach Level 5',
    iconName: 'Star',
    iconColor: 'text-violet-400',
    check: (d) => d.level >= 5,
  },
  {
    id: 'level_10',
    name: 'Dedicated',
    description: 'Reach Level 10',
    iconName: 'Trophy',
    iconColor: 'text-violet-500',
    check: (d) => d.level >= 10,
  },
  {
    id: 'coins_500',
    name: 'Coin Collector',
    description: 'Earn 500 total coins',
    iconName: 'Coins',
    iconColor: 'text-amber-400',
    check: (d) => d.totalEarned >= 500,
  },
  {
    id: 'coins_1000',
    name: 'Treasure Hoarder',
    description: 'Earn 1000 total coins',
    iconName: 'Gem',
    iconColor: 'text-amber-500',
    check: (d) => d.totalEarned >= 1000,
  },
  {
    id: 'redeem_1',
    name: 'Treat Yourself',
    description: 'Redeem your first reward',
    iconName: 'Gift',
    iconColor: 'text-pink-400',
    check: (d) => d.hasRedeemedWishlist,
  },
]
