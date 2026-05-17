import { atom } from 'jotai'
import { XPData, ProjectsData, BossData, GuildData, PetData, getDefaultXPData, getDefaultProjectsData, getDefaultBossData, getDefaultGuildData, getDefaultPetData } from '@/lib/types'
import { getLevelFromXP, getXPProgress, calculateStreak, getMaxStreak, generateDailyChallenge, computeWeeklyDNA, StreakMilestone } from '@/lib/gamification'
import { habitsAtom, settingsAtom, coinsAtom } from '@/lib/atoms'
import { DateTime } from 'luxon'

export const xpAtom = atom<XPData>(getDefaultXPData())
export const projectsAtom = atom<ProjectsData>(getDefaultProjectsData())
export const levelUpAtom = atom<number | null>(null)

export const currentLevelAtom = atom(get => getLevelFromXP(get(xpAtom).totalXP))

export const xpProgressAtom = atom(get => getXPProgress(get(xpAtom).totalXP))

export const habitStreaksAtom = atom(get => {
  const habits = get(habitsAtom).habits
  const timezone = get(settingsAtom).system.timezone
  const map = new Map<string, number>()
  habits.filter(h => !h.isTask && !h.archived).forEach(h => {
    map.set(h.id, calculateStreak(h, timezone))
  })
  return map
})

export const maxStreakAtom = atom(get => {
  const streaks = get(habitStreaksAtom)
  return Math.max(0, ...Array.from(streaks.values()))
})

export const dailyChallengeAtom = atom(get => {
  const timezone = get(settingsAtom).system.timezone
  const dateStr = DateTime.now().setZone(timezone).toISODate()!
  return generateDailyChallenge(dateStr)
})

export const dailyChallengeProgressAtom = atom(get => {
  const challenge = get(dailyChallengeAtom)
  const habits = get(habitsAtom).habits
  const coins = get(coinsAtom)
  const timezone = get(settingsAtom).system.timezone
  const todayStr = DateTime.now().setZone(timezone).toISODate()!

  let current = 0

  if (challenge.type === 'complete_n_habits') {
    current = habits.filter(h => {
      const target = h.targetCompletions ?? 1
      const completionsToday = h.completions.filter(c =>
        DateTime.fromISO(c).setZone(timezone).toISODate() === todayStr
      ).length
      return completionsToday >= target
    }).length
  } else if (challenge.type === 'earn_n_coins') {
    current = coins.transactions
      .filter(t => {
        const date = DateTime.fromISO(t.timestamp).setZone(timezone).toISODate()
        return date === todayStr && t.amount > 0
      })
      .reduce((sum, t) => sum + t.amount, 0)
  }

  const isComplete = current >= challenge.target
  return { current, target: challenge.target, isComplete }
})

export const xpEarnedTodayAtom = atom(get => {
  const xpData = get(xpAtom)
  const timezone = get(settingsAtom).system.timezone
  const todayStr = DateTime.now().setZone(timezone).toISODate()!
  return xpData.transactions
    .filter(t => DateTime.fromISO(t.timestamp).setZone(timezone).toISODate() === todayStr)
    .reduce((sum, t) => sum + t.amount, 0)
})

export const bossAtom = atom<BossData>(getDefaultBossData())

export const gemsAtom = atom(get => get(xpAtom).gems ?? 0)

export const shieldsAtom = atom(get => get(xpAtom).shields ?? 0)

export const activeBoostsAtom = atom(get => {
  const boosts = get(xpAtom).activeBoosts ?? []
  return boosts.filter(b => new Date(b.expiresAt) > new Date())
})

export const hasXPBoostAtom = atom(get => get(activeBoostsAtom).some(b => b.type === 'xp_2x'))
export const hasCoinBoostAtom = atom(get => get(activeBoostsAtom).some(b => b.type === 'coins_2x'))
export const hasGemBoostAtom = atom(get => get(activeBoostsAtom).some(b => b.type === 'gem_boost'))

export const completedTodayCountAtom = atom(get => {
  const habits = get(habitsAtom).habits
  const timezone = get(settingsAtom).system.timezone
  const todayStr = DateTime.now().setZone(timezone).toISODate()!
  return habits.filter(h => !h.isTask && !h.archived).filter(h => {
    const target = h.targetCompletions ?? 1
    const completionsToday = h.completions.filter(c =>
      DateTime.fromISO(c).setZone(timezone).toISODate() === todayStr
    ).length
    return completionsToday >= target
  }).length
})

export const totalHabitsDueTodayCountAtom = atom(get => {
  const habits = get(habitsAtom).habits.filter(h => !h.isTask && !h.archived)
  return habits.length
})

export const isPerfectDayAtom = atom(get => {
  const total = get(totalHabitsDueTodayCountAtom)
  const completed = get(completedTodayCountAtom)
  return total > 0 && completed === total
})

export const weeklyDNAAtom = atom(get => {
  const habits = get(habitsAtom).habits
  const timezone = get(settingsAtom).system.timezone
  return computeWeeklyDNA(habits, timezone)
})

export const perfectDayStreakAtom = atom(get => {
  const perfectDays = get(xpAtom).perfectDays ?? []
  if (perfectDays.length === 0) return 0
  const sorted = [...perfectDays].sort().reverse()
  let streak = 0
  for (const dayStr of sorted) {
    const expected = DateTime.now().minus({ days: streak }).toISODate()!
    if (dayStr === expected) streak++
    else break
  }
  return streak
})

export const milestoneModalAtom = atom<StreakMilestone | null>(null)
export const perfectDayModalAtom = atom<boolean>(false)

export const keystoneCompletedTodayAtom = atom(get => {
  const habits = get(habitsAtom).habits
  const timezone = get(settingsAtom).system.timezone
  const todayStr = DateTime.now().setZone(timezone).toISODate()!
  const keystone = habits.find(h => h.isKeystone && !h.isTask && !h.archived)
  if (!keystone) return false
  const target = keystone.targetCompletions ?? 1
  const completionsToday = keystone.completions.filter(c =>
    DateTime.fromISO(c).setZone(timezone).toISODate() === todayStr
  ).length
  return completionsToday >= target
})

export const keystoneMultiplierAtom = atom(get => get(keystoneCompletedTodayAtom) ? 1.25 : 1.0)

export const guildDataAtom = atom<GuildData>(getDefaultGuildData())

export const petDataAtom = atom<PetData>(getDefaultPetData())

import { getCurrentSeason } from './seasons'

export const currentSeasonAtom = atom(() => getCurrentSeason())

export const skillProgressAtom = atom(get => get(xpAtom).skillProgress ?? {})
export const unlockedSkillsAtom = atom(get => get(xpAtom).unlockedSkills ?? [])
