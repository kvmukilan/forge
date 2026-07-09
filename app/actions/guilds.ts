'use server'

import { Guild, GuildData, GuildQuest, GuildQuestType, GuildQuestDifficulty, getDefaultGuildData } from '@/lib/types'
import { v4 as uuid } from 'uuid'
import { getCurrentUser } from '@/lib/server-helpers'
import { getDb } from '@/lib/db'
import { guilds, guildMembers, guildQuests, users, coinTransactions, xpTransactions, xpState } from '@/lib/db/schema'
import { guildToWire } from '@/lib/db/mappers'
import { and, eq, gte, inArray, desc, sql } from 'drizzle-orm'
import { addCoins } from './data'
import { addXP, addGems } from './gamification'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function memberIdsOf(guildId: string): Promise<string[]> {
  const db = await getDb()
  const rows = await db.select({ userId: guildMembers.userId }).from(guildMembers).where(eq(guildMembers.guildId, guildId))
  return rows.map(r => r.userId)
}

function questToWire(row: typeof guildQuests.$inferSelect): GuildQuest {
  return {
    id: row.id,
    guildId: row.guildId,
    type: row.type as GuildQuestType,
    difficulty: row.difficulty as GuildQuestDifficulty,
    title: row.title,
    description: row.description,
    emoji: row.emoji,
    target: row.target,
    weekStart: row.weekStart,
    reward: row.reward as GuildQuest['reward'],
    claimedBy: row.claimedBy as string[],
  }
}

export async function loadGuildData(): Promise<GuildData> {
  const user = await getCurrentUser()
  if (!user) return getDefaultGuildData()
  const db = await getDb()
  const guildRows = await db.select().from(guilds)
  const memberRows = await db.select().from(guildMembers)
  const questRows = await db.select().from(guildQuests)
  const membersByGuild = new Map<string, string[]>()
  for (const m of memberRows) {
    const list = membersByGuild.get(m.guildId) ?? []
    list.push(m.userId)
    membersByGuild.set(m.guildId, list)
  }
  return {
    guilds: guildRows.map(g => guildToWire(g, membersByGuild.get(g.id) ?? [])),
    quests: questRows.map(questToWire),
  }
}

export async function getMyGuild(): Promise<Guild | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDb()
  const membership = await db.select().from(guildMembers).where(eq(guildMembers.userId, user.id)).limit(1)
  if (!membership[0]) return null
  const guildRows = await db.select().from(guilds).where(eq(guilds.id, membership[0].guildId)).limit(1)
  if (!guildRows[0]) return null
  return guildToWire(guildRows[0], await memberIdsOf(guildRows[0].id))
}

export async function createGuild(name: string, emoji: string, description?: string): Promise<{ success: boolean; message: string; guild?: Guild }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const db = await getDb()
  const existing = await db.select().from(guildMembers).where(eq(guildMembers.userId, user.id)).limit(1)
  if (existing[0]) return { success: false, message: 'You are already in a guild' }
  const guild: Guild = {
    id: uuid(),
    name: name.trim(),
    emoji,
    description: description?.trim(),
    inviteCode: generateInviteCode(),
    memberIds: [user.id],
    adminId: user.id,
    createdAt: new Date().toISOString(),
  }
  await db.insert(guilds).values({
    id: guild.id,
    name: guild.name,
    emoji: guild.emoji,
    description: guild.description ?? null,
    inviteCode: guild.inviteCode,
    adminId: guild.adminId,
    createdAt: guild.createdAt,
  })
  await db.insert(guildMembers).values({ guildId: guild.id, userId: user.id })
  return { success: true, message: 'Guild created!', guild }
}

export async function joinGuildByCode(inviteCode: string): Promise<{ success: boolean; message: string; guild?: Guild }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const db = await getDb()
  const existing = await db.select().from(guildMembers).where(eq(guildMembers.userId, user.id)).limit(1)
  if (existing[0]) return { success: false, message: 'You are already in a guild. Leave it first.' }
  const guildRows = await db.select().from(guilds).where(eq(guilds.inviteCode, inviteCode.trim().toUpperCase())).limit(1)
  if (!guildRows[0]) return { success: false, message: 'Invalid invite code' }
  await db.insert(guildMembers).values({ guildId: guildRows[0].id, userId: user.id }).onConflictDoNothing()
  const guild = guildToWire(guildRows[0], await memberIdsOf(guildRows[0].id))
  return { success: true, message: `Joined ${guild.name}!`, guild }
}

export async function leaveGuild(): Promise<{ success: boolean; message: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const db = await getDb()
  const membership = await db.select().from(guildMembers).where(eq(guildMembers.userId, user.id)).limit(1)
  if (!membership[0]) return { success: false, message: 'Not in a guild' }
  const guildId = membership[0].guildId
  const guildRows = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1)
  const memberIds = await memberIdsOf(guildId)

  await db.delete(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, user.id)))

  if (memberIds.length === 1) {
    await db.delete(guilds).where(eq(guilds.id, guildId)) // quests cascade
    return { success: true, message: 'Guild disbanded' }
  }
  if (guildRows[0] && guildRows[0].adminId === user.id) {
    const remaining = memberIds.filter(id => id !== user.id)
    await db.update(guilds).set({ adminId: remaining[0] }).where(eq(guilds.id, guildId))
  }
  return { success: true, message: 'Left guild' }
}

export interface GuildMemberStat {
  userId: string
  username: string
  weeklyCompletions: number
  avatarPath?: string
}

function currentWeekStartISO(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

export async function getGuildLeaderboard(guildId: string): Promise<GuildMemberStat[]> {
  const db = await getDb()
  const memberIds = await memberIdsOf(guildId)
  if (memberIds.length === 0) return []

  const userRows = await db.select().from(users).where(inArray(users.id, memberIds))
  const weekStart = currentWeekStartISO()

  const counts = await db.select({
    userId: coinTransactions.userId,
    count: sql<number>`count(*)::int`,
  }).from(coinTransactions)
    .where(and(
      inArray(coinTransactions.userId, memberIds),
      inArray(coinTransactions.type, ['HABIT_COMPLETION', 'TASK_COMPLETION']),
      sql`${coinTransactions.amount} > 0`,
      gte(coinTransactions.timestamp, weekStart),
    ))
    .groupBy(coinTransactions.userId)

  const countByUser = new Map(counts.map(c => [c.userId, Number(c.count)]))

  const stats: GuildMemberStat[] = memberIds.map(userId => {
    const user = userRows.find(u => u.id === userId)
    return {
      userId,
      username: user?.username ?? 'Unknown',
      weeklyCompletions: countByUser.get(userId) ?? 0,
      ...(user?.avatarPath ? { avatarPath: user.avatarPath } : {}),
    }
  })

  return stats.sort((a, b) => b.weeklyCompletions - a.weeklyCompletions)
}

export interface GuildActivityItem {
  userId: string
  username: string
  description: string
  timestamp: string
  amount: number
}

export async function getGuildActivity(guildId: string): Promise<GuildActivityItem[]> {
  const db = await getDb()
  const memberIds = await memberIdsOf(guildId)
  if (memberIds.length === 0) return []

  const userRows = await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, memberIds))

  const txRows = await db.select().from(coinTransactions)
    .where(and(
      inArray(coinTransactions.userId, memberIds),
      inArray(coinTransactions.type, ['HABIT_COMPLETION', 'TASK_COMPLETION']),
      sql`${coinTransactions.amount} > 0`,
    ))
    .orderBy(desc(coinTransactions.timestamp))
    .limit(20)

  return txRows.map(t => ({
    userId: t.userId,
    username: userRows.find(u => u.id === t.userId)?.username ?? 'Unknown',
    description: t.description,
    timestamp: t.timestamp,
    amount: t.amount,
  }))
}

// ---- GUILD QUESTS ----

type QuestTemplate = {
  type: GuildQuestType
  emoji: string
  titleFn: (target: number) => string
  descriptionFn: (target: number) => string
  targets: { easy: number; medium: number; hard: number }
  rewards: { easy: { coins: number; xp: number; gems: number }; medium: { coins: number; xp: number; gems: number }; hard: { coins: number; xp: number; gems: number } }
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    type: 'habit_blitz',
    emoji: '⚡',
    titleFn: (t) => `Habit Blitz: ${t}`,
    descriptionFn: (t) => `Complete ${t} habits as a guild this week.`,
    targets: { easy: 20, medium: 50, hard: 100 },
    rewards: { easy: { coins: 50, xp: 200, gems: 1 }, medium: { coins: 120, xp: 500, gems: 2 }, hard: { coins: 250, xp: 1000, gems: 5 } },
  },
  {
    type: 'coin_surge',
    emoji: '🪙',
    titleFn: (t) => `Coin Surge: ${t}`,
    descriptionFn: (t) => `Earn ${t} coins as a guild this week.`,
    targets: { easy: 200, medium: 600, hard: 1500 },
    rewards: { easy: { coins: 60, xp: 180, gems: 1 }, medium: { coins: 130, xp: 450, gems: 2 }, hard: { coins: 280, xp: 900, gems: 5 } },
  },
  {
    type: 'boss_assault',
    emoji: '⚔️',
    titleFn: (t) => `Boss Assault: ${t} Hits`,
    descriptionFn: (t) => `Deal ${t} hits to the Weekly Boss as a guild.`,
    targets: { easy: 15, medium: 40, hard: 80 },
    rewards: { easy: { coins: 55, xp: 220, gems: 1 }, medium: { coins: 125, xp: 520, gems: 2 }, hard: { coins: 260, xp: 1050, gems: 5 } },
  },
  {
    type: 'perfect_streak',
    emoji: '🌟',
    titleFn: (t) => `Perfect Streak: ${t} Days`,
    descriptionFn: (t) => `Achieve ${t} perfect days across the guild this week.`,
    targets: { easy: 3, medium: 7, hard: 14 },
    rewards: { easy: { coins: 70, xp: 250, gems: 2 }, medium: { coins: 150, xp: 600, gems: 3 }, hard: { coins: 300, xp: 1200, gems: 6 } },
  },
  {
    type: 'level_up_rush',
    emoji: '📈',
    titleFn: (t) => `XP Rush: ${t} XP`,
    descriptionFn: (t) => `Earn ${t} XP as a guild this week.`,
    targets: { easy: 500, medium: 1500, hard: 4000 },
    rewards: { easy: { coins: 45, xp: 230, gems: 1 }, medium: { coins: 110, xp: 550, gems: 2 }, hard: { coins: 240, xp: 1100, gems: 5 } },
  },
]

function seededRandom(seed: string): () => number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return () => {
    hash = ((hash << 5) - hash) + 31
    hash |= 0
    return Math.abs(hash) / 2147483647
  }
}

function generateWeeklyQuests(guildId: string, weekStart: string): GuildQuest[] {
  const rand = seededRandom(`${guildId}-${weekStart}`)
  const shuffled = [...QUEST_TEMPLATES].sort(() => rand() - 0.5)
  const difficulties: GuildQuestDifficulty[] = ['easy', 'medium', 'hard']

  return difficulties.map((difficulty, i) => {
    const template = shuffled[i % shuffled.length]
    const target = template.targets[difficulty]
    const reward = template.rewards[difficulty]
    return {
      id: `${guildId}-${weekStart}-${difficulty}`,
      guildId,
      type: template.type,
      difficulty,
      title: template.titleFn(target),
      description: template.descriptionFn(target),
      emoji: template.emoji,
      target,
      weekStart,
      reward,
      claimedBy: [],
    }
  })
}

async function calcQuestProgress(quest: GuildQuest, memberIds: string[]): Promise<number> {
  const db = await getDb()
  const weekStart = quest.weekStart
  const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  if (quest.type === 'habit_blitz' || quest.type === 'boss_assault') {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(coinTransactions)
      .where(and(
        inArray(coinTransactions.userId, memberIds),
        inArray(coinTransactions.type, ['HABIT_COMPLETION', 'TASK_COMPLETION']),
        gte(coinTransactions.timestamp, weekStart),
        sql`${coinTransactions.timestamp} < ${weekEnd}`,
      ))
    return Number(row?.count ?? 0)
  }

  if (quest.type === 'coin_surge') {
    const [row] = await db.select({ total: sql<number>`coalesce(sum(${coinTransactions.amount}), 0)::int` }).from(coinTransactions)
      .where(and(
        inArray(coinTransactions.userId, memberIds),
        sql`${coinTransactions.amount} > 0`,
        gte(coinTransactions.timestamp, weekStart),
        sql`${coinTransactions.timestamp} < ${weekEnd}`,
      ))
    return Number(row?.total ?? 0)
  }

  if (quest.type === 'perfect_streak') {
    const states = await db.select({ perfectDays: xpState.perfectDays }).from(xpState).where(inArray(xpState.userId, memberIds))
    return states.flatMap(s => (s.perfectDays as string[]) ?? [])
      .filter(d => d >= weekStart && d < weekEnd.slice(0, 10)).length
  }

  if (quest.type === 'level_up_rush') {
    const [row] = await db.select({ total: sql<number>`coalesce(sum(${xpTransactions.amount}), 0)::int` }).from(xpTransactions)
      .where(and(
        inArray(xpTransactions.userId, memberIds),
        gte(xpTransactions.timestamp, weekStart),
        sql`${xpTransactions.timestamp} < ${weekEnd}`,
      ))
    return Number(row?.total ?? 0)
  }

  return 0
}

export interface GuildQuestWithProgress extends GuildQuest {
  progress: number
  isComplete: boolean
}

export async function getGuildQuests(guildId: string): Promise<GuildQuestWithProgress[]> {
  const db = await getDb()
  const memberIds = await memberIdsOf(guildId)
  if (memberIds.length === 0) return []

  const weekStart = currentWeekStartISO()

  let weekQuestRows = await db.select().from(guildQuests)
    .where(and(eq(guildQuests.guildId, guildId), eq(guildQuests.weekStart, weekStart)))
  if (weekQuestRows.length === 0) {
    const generated = generateWeeklyQuests(guildId, weekStart)
    await db.insert(guildQuests).values(generated.map(q => ({
      id: q.id,
      guildId: q.guildId,
      type: q.type,
      difficulty: q.difficulty,
      title: q.title,
      description: q.description,
      emoji: q.emoji,
      target: q.target,
      weekStart: q.weekStart,
      reward: q.reward,
      claimedBy: [],
    }))).onConflictDoNothing()
    weekQuestRows = await db.select().from(guildQuests)
      .where(and(eq(guildQuests.guildId, guildId), eq(guildQuests.weekStart, weekStart)))
  }

  const results: GuildQuestWithProgress[] = []
  for (const row of weekQuestRows) {
    const quest = questToWire(row)
    const progress = await calcQuestProgress(quest, memberIds)
    const isComplete = progress >= quest.target
    results.push({ ...quest, progress, isComplete })
  }

  // Auto-distribute rewards for completed quests
  for (const quest of results) {
    if (!quest.isComplete) continue
    const unclaimedMembers = memberIds.filter(uid => !quest.claimedBy.includes(uid))
    if (unclaimedMembers.length === 0) continue
    for (const uid of unclaimedMembers) {
      if (quest.reward.coins > 0) {
        await addCoins({ amount: quest.reward.coins, type: 'MANUAL_ADJUSTMENT', description: `Guild Quest: ${quest.title}`, userId: uid })
      }
      if (quest.reward.xp > 0) {
        await addXP({ amount: quest.reward.xp, source: 'DAILY_CHALLENGE', userId: uid })
      }
      if (quest.reward.gems > 0) {
        await addGems(quest.reward.gems, uid)
      }
    }
    await db.update(guildQuests).set({ claimedBy: memberIds }).where(eq(guildQuests.id, quest.id))
    quest.claimedBy = memberIds
  }

  return results
}
