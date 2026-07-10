'use server'

import { DateTime } from 'luxon'
import { v4 as uuid } from 'uuid'
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  loginClaims, dailyQuests, chestOpenings, leagueCohorts, leagueMembers,
  completions, habits, coinTransactions, pets, users, xpState,
} from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/server-helpers'
import { addCoins, loadSettings } from './data'
import { addXP, addGems, loadXPData, saveXPData } from './gamification'
import type { XPData } from '@/lib/types'
import { LOGIN_REWARDS, LEAGUE_TIERS, type LoginReward } from '@/lib/retention'

// ---------------------------------------------------------------------------
// Daily login calendar — 7-day escalating rewards, gap resets unless shielded
// ---------------------------------------------------------------------------

export interface LoginCalendarState {
  todayClaimed: boolean
  streakIndex: number // 1..7 — the calendar position for today
  rewards: LoginReward[]
}

async function userToday(): Promise<string> {
  const settings = await loadSettings()
  return DateTime.now().setZone(settings.system.timezone).toISODate()!
}

async function computeStreakIndex(userId: string, today: string): Promise<{ index: number; todayClaimed: boolean }> {
  const db = await getDb()
  const [todayClaim] = await db.select().from(loginClaims)
    .where(and(eq(loginClaims.userId, userId), eq(loginClaims.claimDate, today))).limit(1)
  if (todayClaim) return { index: todayClaim.streakIndex, todayClaimed: true }

  const yesterday = DateTime.fromISO(today).minus({ days: 1 }).toISODate()!
  const [yesterdayClaim] = await db.select().from(loginClaims)
    .where(and(eq(loginClaims.userId, userId), eq(loginClaims.claimDate, yesterday))).limit(1)
  if (yesterdayClaim) return { index: (yesterdayClaim.streakIndex % 7) + 1, todayClaimed: false }

  // A streak shield spent on yesterday keeps the calendar alive too
  const dayBefore = DateTime.fromISO(today).minus({ days: 2 }).toISODate()!
  const xp = await loadXPData()
  if ((xp.shieldUsedDates ?? []).includes(yesterday)) {
    const [dayBeforeClaim] = await db.select().from(loginClaims)
      .where(and(eq(loginClaims.userId, userId), eq(loginClaims.claimDate, dayBefore))).limit(1)
    if (dayBeforeClaim) return { index: (dayBeforeClaim.streakIndex % 7) + 1, todayClaimed: false }
  }

  return { index: 1, todayClaimed: false }
}

export async function getLoginCalendarState(): Promise<LoginCalendarState | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const today = await userToday()
  const { index, todayClaimed } = await computeStreakIndex(user.id, today)
  return { todayClaimed, streakIndex: index, rewards: LOGIN_REWARDS }
}

export async function claimDailyLogin(): Promise<{ claimed: boolean; streakIndex: number; reward: LoginReward } | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDb()
  const today = await userToday()

  const { index, todayClaimed } = await computeStreakIndex(user.id, today)
  if (todayClaimed) return { claimed: false, streakIndex: index, reward: LOGIN_REWARDS[index - 1] }

  const reward = LOGIN_REWARDS[index - 1]
  const inserted = await db.insert(loginClaims).values({
    userId: user.id,
    claimDate: today,
    streakIndex: index,
    reward,
  }).onConflictDoNothing().returning()
  if (inserted.length === 0) {
    // Raced with another request; treat as already claimed
    return { claimed: false, streakIndex: index, reward }
  }

  if (reward.coins) {
    await addCoins({ amount: reward.coins, description: `Daily login — day ${index}`, type: 'MANUAL_ADJUSTMENT' })
  }
  if (reward.gems) {
    await addGems(reward.gems)
  }
  // Day-7 chest is opened separately via openChest('login_day7')
  return { claimed: true, streakIndex: index, reward }
}

// ---------------------------------------------------------------------------
// Daily quests — 3 rotating micro-goals, deterministic per user + date
// ---------------------------------------------------------------------------

export type DailyQuestKey = 'complete_3' | 'complete_keystone' | 'early_bird' | 'earn_30_coins' | 'feed_pet' | 'complete_1'

interface QuestDef {
  key: DailyQuestKey
  title: string
  description: string
  target: number
  reward: { coins: number; xp: number }
}

const QUEST_POOL: QuestDef[] = [
  { key: 'complete_1', title: 'First Spark', description: 'Complete any habit today', target: 1, reward: { coins: 10, xp: 25 } },
  { key: 'complete_3', title: 'Triple Strike', description: 'Complete 3 habits today', target: 3, reward: { coins: 20, xp: 50 } },
  { key: 'complete_keystone', title: 'Keystone', description: 'Complete your keystone habit', target: 1, reward: { coins: 15, xp: 40 } },
  { key: 'early_bird', title: 'Early Bird', description: 'Complete a habit before noon', target: 1, reward: { coins: 15, xp: 40 } },
  { key: 'earn_30_coins', title: 'Coin Rush', description: 'Earn 30 coins today', target: 30, reward: { coins: 15, xp: 40 } },
  { key: 'feed_pet', title: 'Caretaker', description: 'Feed your companion', target: 1, reward: { coins: 10, xp: 30 } },
]

function seededPick<T>(items: T[], count: number, seed: string): T[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  const pool = [...items]
  const picked: T[] = []
  while (picked.length < count && pool.length > 0) {
    hash = Math.abs(((hash << 5) - hash + 31) | 0)
    picked.push(pool.splice(hash % pool.length, 1)[0])
  }
  return picked
}

async function questProgress(userId: string, quest: QuestDef, timezone: string): Promise<number> {
  const db = await getDb()
  const now = DateTime.now().setZone(timezone)
  const dayStartUTC = now.startOf('day').toUTC().toISO()!
  const dayEndUTC = now.endOf('day').toUTC().toISO()!

  switch (quest.key) {
    case 'complete_1':
    case 'complete_3': {
      const [row] = await db.select({ count: sql<number>`count(distinct ${completions.habitId})::int` })
        .from(completions)
        .where(and(eq(completions.userId, userId), gte(completions.completedAt, dayStartUTC), lt(completions.completedAt, dayEndUTC)))
      return Number(row?.count ?? 0)
    }
    case 'complete_keystone': {
      const keystones = await db.select({ id: habits.id }).from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.isKeystone, true), eq(habits.archived, false)))
      if (keystones.length === 0) return 0
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(completions)
        .where(and(
          inArray(completions.habitId, keystones.map(k => k.id)),
          gte(completions.completedAt, dayStartUTC),
          lt(completions.completedAt, dayEndUTC),
        ))
      return Number(row?.count ?? 0) > 0 ? 1 : 0
    }
    case 'early_bird': {
      const noonUTC = now.startOf('day').plus({ hours: 12 }).toUTC().toISO()!
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(completions)
        .where(and(eq(completions.userId, userId), gte(completions.completedAt, dayStartUTC), lt(completions.completedAt, noonUTC)))
      return Number(row?.count ?? 0) > 0 ? 1 : 0
    }
    case 'earn_30_coins': {
      const [row] = await db.select({ total: sql<number>`coalesce(sum(${coinTransactions.amount}) filter (where ${coinTransactions.amount} > 0), 0)::int` })
        .from(coinTransactions)
        .where(and(eq(coinTransactions.userId, userId), gte(coinTransactions.timestamp, dayStartUTC), lt(coinTransactions.timestamp, dayEndUTC)))
      return Number(row?.total ?? 0)
    }
    case 'feed_pet': {
      const [pet] = await db.select().from(pets).where(eq(pets.userId, userId)).limit(1)
      if (!pet?.lastFedAt) return 0
      const fedToday = DateTime.fromISO(pet.lastFedAt).setZone(timezone).toISODate() === now.toISODate()
      return fedToday ? 1 : 0
    }
  }
}

export interface DailyQuestWithProgress extends QuestDef {
  progress: number
  isComplete: boolean
  claimed: boolean
}

export async function getDailyQuests(): Promise<DailyQuestWithProgress[]> {
  const user = await getCurrentUser()
  if (!user) return []
  const db = await getDb()
  const settings = await loadSettings()
  const timezone = settings.system.timezone
  const today = DateTime.now().setZone(timezone).toISODate()!

  // Users without a pet or keystone habit shouldn't get quests they can't do
  const [pet] = await db.select().from(pets).where(eq(pets.userId, user.id)).limit(1)
  const keystones = await db.select({ id: habits.id }).from(habits)
    .where(and(eq(habits.userId, user.id), eq(habits.isKeystone, true), eq(habits.archived, false)))
  const eligible = QUEST_POOL.filter(q =>
    (q.key !== 'feed_pet' || !!pet) &&
    (q.key !== 'complete_keystone' || keystones.length > 0)
  )
  const questDefs = seededPick(eligible, 3, `${user.id}-${today}`)

  const claims = await db.select().from(dailyQuests)
    .where(and(eq(dailyQuests.userId, user.id), eq(dailyQuests.questDate, today)))

  const result: DailyQuestWithProgress[] = []
  for (const quest of questDefs) {
    const progress = await questProgress(user.id, quest, timezone)
    result.push({
      ...quest,
      progress: Math.min(progress, quest.target),
      isComplete: progress >= quest.target,
      claimed: claims.some(c => c.questKey === quest.key && c.claimed),
    })
  }
  return result
}

export async function claimDailyQuest(questKey: DailyQuestKey): Promise<{ success: boolean; message: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const db = await getDb()
  const quests = await getDailyQuests()
  const quest = quests.find(q => q.key === questKey)
  if (!quest) return { success: false, message: 'Quest not available today' }
  if (!quest.isComplete) return { success: false, message: 'Quest not complete yet' }
  if (quest.claimed) return { success: false, message: 'Already claimed' }

  const settings = await loadSettings()
  const today = DateTime.now().setZone(settings.system.timezone).toISODate()!
  const inserted = await db.insert(dailyQuests).values({
    userId: user.id,
    questDate: today,
    questKey,
    target: quest.target,
    claimed: true,
  }).onConflictDoNothing().returning()
  if (inserted.length === 0) return { success: false, message: 'Already claimed' }

  await addCoins({ amount: quest.reward.coins, description: `Daily quest: ${quest.title}`, type: 'MANUAL_ADJUSTMENT' })
  await addXP({ amount: quest.reward.xp, source: 'DAILY_CHALLENGE' })
  return { success: true, message: `+${quest.reward.coins} coins, +${quest.reward.xp} XP` }
}

// ---------------------------------------------------------------------------
// Mystery chest — variable-ratio reward
// ---------------------------------------------------------------------------

export type ChestSource = 'login_day7' | 'daily_quests'

export interface ChestReward {
  kind: 'coins' | 'gems' | 'boost' | 'shield'
  amount: number
  label: string
}

async function chestEntitled(userId: string, source: ChestSource, today: string): Promise<boolean> {
  const db = await getDb()
  const sourceKey = `${source}:${today}`
  const opened = await db.select().from(chestOpenings)
    .where(and(eq(chestOpenings.userId, userId), eq(chestOpenings.source, sourceKey))).limit(1)
  if (opened.length > 0) return false

  if (source === 'login_day7') {
    const [claim] = await db.select().from(loginClaims)
      .where(and(eq(loginClaims.userId, userId), eq(loginClaims.claimDate, today))).limit(1)
    return claim?.streakIndex === 7
  }
  // daily_quests: every quest generated for today must be claimed
  const quests = await getDailyQuests()
  return quests.length > 0 && quests.every(q => q.claimed)
}

export async function getChestAvailability(): Promise<{ login_day7: boolean; daily_quests: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { login_day7: false, daily_quests: false }
  const today = await userToday()
  return {
    login_day7: await chestEntitled(user.id, 'login_day7', today),
    daily_quests: await chestEntitled(user.id, 'daily_quests', today),
  }
}

export async function openChest(source: ChestSource): Promise<{ success: boolean; reward?: ChestReward; message: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const db = await getDb()
  const today = await userToday()

  if (!(await chestEntitled(user.id, source, today))) {
    return { success: false, message: 'No chest available' }
  }

  // Weighted roll: coins 60%, gems 25%, boost 10%, shield 5%
  const roll = Math.random()
  let reward: ChestReward
  const xp: XPData = await loadXPData()
  if (roll < 0.6) {
    const amount = 20 + Math.floor(Math.random() * 41) // 20–60
    reward = { kind: 'coins', amount, label: `${amount} coins` }
    await addCoins({ amount, description: 'Mystery chest', type: 'MANUAL_ADJUSTMENT' })
  } else if (roll < 0.85) {
    const amount = 1 + Math.floor(Math.random() * 3) // 1–3
    reward = { kind: 'gems', amount, label: `${amount} gem${amount > 1 ? 's' : ''}` }
    await addGems(amount)
  } else if (roll < 0.95 || (xp.shields ?? 0) >= 3) {
    const expiresAt = DateTime.now().plus({ hours: 12 }).toISO()!
    const activeBoosts = (xp.activeBoosts ?? []).filter(b => b.type !== 'xp_2x' && new Date(b.expiresAt) > new Date())
    await saveXPData({ ...xp, activeBoosts: [...activeBoosts, { type: 'xp_2x', expiresAt }] })
    reward = { kind: 'boost', amount: 12, label: '2× XP for 12 hours' }
  } else {
    await saveXPData({ ...xp, shields: (xp.shields ?? 0) + 1 })
    reward = { kind: 'shield', amount: 1, label: 'A streak shield' }
  }

  await db.insert(chestOpenings).values({
    id: uuid(),
    userId: user.id,
    source: `${source}:${today}`,
    reward,
    openedAt: new Date().toISOString(),
  })
  return { success: true, reward, message: reward.label }
}

// ---------------------------------------------------------------------------
// Weekly league — small cohorts, 5 tiers, promotion/demotion
// ---------------------------------------------------------------------------

const COHORT_SIZE = 15
const PROMOTE_COUNT = 3
const DEMOTE_COUNT = 3

function currentLeagueWeekStart(): string {
  const now = DateTime.utc()
  return now.minus({ days: (now.weekday - 1) }).toISODate()!
}

// The user's tier = where their last closed week left them
async function tierForUser(userId: string): Promise<number> {
  const db = await getDb()
  const rows = await db.select({
    tier: leagueCohorts.tier,
    result: leagueMembers.result,
    weekStart: leagueCohorts.weekStart,
  })
    .from(leagueMembers)
    .innerJoin(leagueCohorts, eq(leagueMembers.cohortId, leagueCohorts.id))
    .where(and(eq(leagueMembers.userId, userId), sql`${leagueMembers.result} is not null`))
    .orderBy(desc(leagueCohorts.weekStart))
    .limit(1)
  if (!rows[0]) return 1
  const { tier, result } = rows[0]
  if (result === 'promote') return Math.min(LEAGUE_TIERS.length, tier + 1)
  if (result === 'demote') return Math.max(1, tier - 1)
  return tier
}

async function assignToCohort(userId: string, weekStart: string): Promise<string> {
  const db = await getDb()
  const tier = await tierForUser(userId)

  // Reuse a cohort of this tier with room, else create one
  const cohorts = await db.select().from(leagueCohorts)
    .where(and(eq(leagueCohorts.weekStart, weekStart), eq(leagueCohorts.tier, tier)))
  for (const cohort of cohorts) {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(leagueMembers)
      .where(eq(leagueMembers.cohortId, cohort.id))
    if (Number(row?.count ?? 0) < COHORT_SIZE) {
      await db.insert(leagueMembers).values({ cohortId: cohort.id, userId }).onConflictDoNothing()
      return cohort.id
    }
  }
  const cohortId = uuid()
  await db.insert(leagueCohorts).values({ id: cohortId, weekStart, tier })
  await db.insert(leagueMembers).values({ cohortId, userId }).onConflictDoNothing()
  return cohortId
}

async function liveScores(cohortId: string, weekStart: string): Promise<Map<string, number>> {
  const db = await getDb()
  const members = await db.select({ userId: leagueMembers.userId }).from(leagueMembers)
    .where(eq(leagueMembers.cohortId, cohortId))
  const memberIds = members.map(m => m.userId)
  const scores = new Map<string, number>(memberIds.map(id => [id, 0]))
  if (memberIds.length === 0) return scores

  const weekStartISO = `${weekStart}T00:00:00.000Z`
  const weekEndISO = DateTime.fromISO(weekStart).plus({ days: 7 }).toISODate()! + 'T00:00:00.000Z'
  const rows = await db.select({
    userId: completions.userId,
    difficulty: habits.difficulty,
  })
    .from(completions)
    .innerJoin(habits, eq(completions.habitId, habits.id))
    .where(and(
      inArray(completions.userId, memberIds),
      gte(completions.completedAt, weekStartISO),
      lt(completions.completedAt, weekEndISO),
    ))
  const weights: Record<string, number> = { easy: 1, medium: 2, hard: 3 }
  for (const row of rows) {
    scores.set(row.userId, (scores.get(row.userId) ?? 0) + (weights[row.difficulty ?? 'medium'] ?? 2))
  }
  return scores
}

export interface LeagueStanding {
  userId: string
  username: string
  avatarPath?: string
  score: number
  isMe: boolean
  zone: 'promote' | 'stay' | 'demote'
}

export interface LeagueState {
  tier: number
  tierName: string
  weekStart: string
  standings: LeagueStanding[]
  endsInDays: number
}

export async function getMyLeague(): Promise<LeagueState | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDb()
  const weekStart = currentLeagueWeekStart()

  // Lazy join: an active user (any completion, ever) gets a cohort on first view
  let [membership] = await db.select({ cohortId: leagueMembers.cohortId })
    .from(leagueMembers)
    .innerJoin(leagueCohorts, eq(leagueMembers.cohortId, leagueCohorts.id))
    .where(and(eq(leagueMembers.userId, user.id), eq(leagueCohorts.weekStart, weekStart)))
    .limit(1)
  if (!membership) {
    const [anyCompletion] = await db.select({ userId: completions.userId }).from(completions)
      .where(eq(completions.userId, user.id)).limit(1)
    if (!anyCompletion) return null
    const cohortId = await assignToCohort(user.id, weekStart)
    membership = { cohortId }
  }

  const [cohort] = await db.select().from(leagueCohorts).where(eq(leagueCohorts.id, membership.cohortId)).limit(1)
  if (!cohort) return null

  const scores = await liveScores(cohort.id, weekStart)
  const memberIds = [...scores.keys()]
  const userRows = memberIds.length > 0
    ? await db.select({ id: users.id, username: users.username, avatarPath: users.avatarPath }).from(users).where(inArray(users.id, memberIds))
    : []

  const ranked = memberIds
    .map(id => ({ userId: id, score: scores.get(id) ?? 0 }))
    .sort((a, b) => b.score - a.score)

  const standings: LeagueStanding[] = ranked.map((entry, i) => {
    const u = userRows.find(r => r.id === entry.userId)
    const zone: LeagueStanding['zone'] =
      i < PROMOTE_COUNT && cohort.tier < LEAGUE_TIERS.length ? 'promote'
        : i >= ranked.length - DEMOTE_COUNT && cohort.tier > 1 && ranked.length > PROMOTE_COUNT + DEMOTE_COUNT ? 'demote'
          : 'stay'
    return {
      userId: entry.userId,
      username: u?.username ?? 'Unknown',
      ...(u?.avatarPath ? { avatarPath: u.avatarPath } : {}),
      score: entry.score,
      isMe: entry.userId === user.id,
      zone,
    }
  })

  const endsInDays = Math.max(0, Math.ceil(DateTime.fromISO(weekStart).plus({ days: 7 }).diff(DateTime.utc(), 'days').days))

  return {
    tier: cohort.tier,
    tierName: LEAGUE_TIERS[cohort.tier - 1],
    weekStart,
    standings,
    endsInDays,
  }
}

// One roundtrip for the dashboard retention panel
export interface RetentionState {
  calendar: LoginCalendarState
  quests: DailyQuestWithProgress[]
  chests: { login_day7: boolean; daily_quests: boolean }
}

export async function getRetentionState(): Promise<RetentionState | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const calendar = await getLoginCalendarState()
  if (!calendar) return null
  const quests = await getDailyQuests()
  const chests = await getChestAvailability()
  return { calendar, quests, chests }
}

// Called by the weekly cron: finalize last week's cohorts and stamp results
export async function closeLeagueWeek(weekStart: string): Promise<number> {
  const db = await getDb()
  const cohorts = await db.select().from(leagueCohorts).where(eq(leagueCohorts.weekStart, weekStart))
  let closed = 0
  for (const cohort of cohorts) {
    const members = await db.select().from(leagueMembers).where(eq(leagueMembers.cohortId, cohort.id))
    if (members.some(m => m.result !== null)) continue // already closed
    const scores = await liveScores(cohort.id, weekStart)
    const ranked = members
      .map(m => ({ ...m, score: scores.get(m.userId) ?? 0 }))
      .sort((a, b) => b.score - a.score)
    for (let i = 0; i < ranked.length; i++) {
      const canDemote = cohort.tier > 1 && ranked.length > PROMOTE_COUNT + DEMOTE_COUNT
      const result =
        i < PROMOTE_COUNT && cohort.tier < LEAGUE_TIERS.length ? 'promote'
          : canDemote && i >= ranked.length - DEMOTE_COUNT ? 'demote'
            : 'stay'
      await db.update(leagueMembers)
        .set({ score: ranked[i].score, result })
        .where(and(eq(leagueMembers.cohortId, cohort.id), eq(leagueMembers.userId, ranked[i].userId)))
    }
    closed++
  }
  return closed
}
