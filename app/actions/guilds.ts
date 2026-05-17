'use server'

import fs from 'fs/promises'
import path from 'path'
import { Guild, GuildData, GuildQuest, GuildQuestType, GuildQuestDifficulty, getDefaultGuildData, UserId } from '@/lib/types'
import { v4 as uuid } from 'uuid'
import { getCurrentUser } from '@/lib/server-helpers'
import { addCoins } from './data'
import { addXP, addGems } from './gamification'

async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data')
  try { await fs.access(dataDir) } catch { await fs.mkdir(dataDir, { recursive: true }) }
}

async function readJSON<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDataDir()
  const filePath = path.join(process.cwd(), 'data', filename)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

async function writeJSON<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(process.cwd(), 'data', filename)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function loadGuildData(): Promise<GuildData> {
  return readJSON('guilds.json', getDefaultGuildData())
}

export async function saveGuildData(data: GuildData): Promise<void> {
  await writeJSON('guilds.json', data)
}

export async function getMyGuild(): Promise<Guild | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const data = await loadGuildData()
  return data.guilds.find(g => g.memberIds.includes(user.id)) ?? null
}

export async function createGuild(name: string, emoji: string, description?: string): Promise<{ success: boolean; message: string; guild?: Guild }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const data = await loadGuildData()
  const alreadyInGuild = data.guilds.some(g => g.memberIds.includes(user.id))
  if (alreadyInGuild) return { success: false, message: 'You are already in a guild' }
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
  await saveGuildData({ guilds: [...data.guilds, guild], quests: data.quests ?? [] })
  return { success: true, message: 'Guild created!', guild }
}

export async function joinGuildByCode(inviteCode: string): Promise<{ success: boolean; message: string; guild?: Guild }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const data = await loadGuildData()
  const alreadyInGuild = data.guilds.some(g => g.memberIds.includes(user.id))
  if (alreadyInGuild) return { success: false, message: 'You are already in a guild. Leave it first.' }
  const guildIdx = data.guilds.findIndex(g => g.inviteCode === inviteCode.trim().toUpperCase())
  if (guildIdx === -1) return { success: false, message: 'Invalid invite code' }
  const guild = data.guilds[guildIdx]
  if (guild.memberIds.includes(user.id)) return { success: false, message: 'Already a member' }
  const updatedGuild = { ...guild, memberIds: [...guild.memberIds, user.id] }
  const updatedGuilds = data.guilds.map((g, i) => i === guildIdx ? updatedGuild : g)
  await saveGuildData({ guilds: updatedGuilds, quests: data.quests ?? [] })
  return { success: true, message: `Joined ${guild.name}!`, guild: updatedGuild }
}

export async function leaveGuild(): Promise<{ success: boolean; message: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, message: 'Not authenticated' }
  const data = await loadGuildData()
  const guildIdx = data.guilds.findIndex(g => g.memberIds.includes(user.id))
  if (guildIdx === -1) return { success: false, message: 'Not in a guild' }
  const guild = data.guilds[guildIdx]
  if (guild.memberIds.length === 1) {
    await saveGuildData({ guilds: data.guilds.filter((_, i) => i !== guildIdx), quests: (data.quests ?? []).filter(q => q.guildId !== guild.id) })
    return { success: true, message: 'Guild disbanded' }
  }
  const newMembers = guild.memberIds.filter((id: UserId) => id !== user.id)
  const newAdmin = guild.adminId === user.id ? newMembers[0] : guild.adminId
  const updatedGuild = { ...guild, memberIds: newMembers, adminId: newAdmin }
  await saveGuildData({ guilds: data.guilds.map((g, i) => i === guildIdx ? updatedGuild : g), quests: data.quests ?? [] })
  return { success: true, message: 'Left guild' }
}

export interface GuildMemberStat {
  userId: string
  username: string
  weeklyCompletions: number
  avatarPath?: string
}

export async function getGuildLeaderboard(guildId: string): Promise<GuildMemberStat[]> {
  const data = await loadGuildData()
  const guild = data.guilds.find(g => g.id === guildId)
  if (!guild) return []

  const { users } = await readJSON<{ users: Array<{ id: string; username: string; avatarPath?: string }> }>('auth.json', { users: [] })

  const { transactions } = await readJSON<{ balance: number; transactions: Array<{ userId?: string; amount: number; type: string; timestamp: string }> }>('coins.json', { balance: 0, transactions: [] })

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const stats: GuildMemberStat[] = guild.memberIds.map(userId => {
    const user = users.find(u => u.id === userId)
    const weeklyCompletions = transactions.filter(t =>
      t.userId === userId &&
      (t.type === 'HABIT_COMPLETION' || t.type === 'TASK_COMPLETION') &&
      t.amount > 0 &&
      new Date(t.timestamp) >= weekStart
    ).length
    return {
      userId,
      username: user?.username ?? 'Unknown',
      weeklyCompletions,
      avatarPath: user?.avatarPath,
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
  const data = await loadGuildData()
  const guild = data.guilds.find(g => g.id === guildId)
  if (!guild) return []

  const { users } = await readJSON<{ users: Array<{ id: string; username: string }> }>('auth.json', { users: [] })

  const { transactions } = await readJSON<{ balance: number; transactions: Array<{ id: string; userId?: string; amount: number; type: string; description: string; timestamp: string }> }>('coins.json', { balance: 0, transactions: [] })

  const memberSet = new Set(guild.memberIds)

  return transactions
    .filter(t =>
      t.userId && memberSet.has(t.userId) &&
      (t.type === 'HABIT_COMPLETION' || t.type === 'TASK_COMPLETION') &&
      t.amount > 0
    )
    .slice(-20)
    .reverse()
    .map(t => ({
      userId: t.userId!,
      username: users.find(u => u.id === t.userId)?.username ?? 'Unknown',
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

async function getWeekStart(): Promise<string> {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().slice(0, 10)
}

async function calcQuestProgress(quest: GuildQuest, memberIds: string[]): Promise<number> {
  const weekStart = quest.weekStart
  const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  if (quest.type === 'habit_blitz' || quest.type === 'boss_assault') {
    const coinsData = await readJSON<{ transactions: Array<{ userId?: string; type: string; timestamp: string; amount: number }> }>(
      'coins.json', { transactions: [] }
    )
    return coinsData.transactions.filter(t =>
      t.userId && memberIds.includes(t.userId) &&
      (t.type === 'HABIT_COMPLETION' || t.type === 'TASK_COMPLETION') &&
      t.timestamp >= weekStart && t.timestamp < weekEnd
    ).length
  }

  if (quest.type === 'coin_surge') {
    const coinsData = await readJSON<{ transactions: Array<{ userId?: string; type: string; timestamp: string; amount: number }> }>(
      'coins.json', { transactions: [] }
    )
    return coinsData.transactions
      .filter(t =>
        t.userId && memberIds.includes(t.userId) &&
        t.amount > 0 &&
        t.timestamp >= weekStart && t.timestamp < weekEnd
      )
      .reduce((sum, t) => sum + t.amount, 0)
  }

  if (quest.type === 'perfect_streak') {
    const xpData = await readJSON<{ perfectDays?: string[] }>('xp.json', { perfectDays: [] })
    const perfectDays = xpData.perfectDays ?? []
    return perfectDays.filter(d => d >= weekStart && d < weekEnd.slice(0, 10)).length
  }

  if (quest.type === 'level_up_rush') {
    const xpData = await readJSON<{ transactions?: Array<{ userId?: string; timestamp: string; amount: number }> }>(
      'xp.json', { transactions: [] }
    )
    return (xpData.transactions ?? [])
      .filter(t =>
        t.userId && memberIds.includes(t.userId) &&
        t.timestamp >= weekStart && t.timestamp < weekEnd
      )
      .reduce((sum, t) => sum + t.amount, 0)
  }

  return 0
}

export interface GuildQuestWithProgress extends GuildQuest {
  progress: number
  isComplete: boolean
}

export async function getGuildQuests(guildId: string): Promise<GuildQuestWithProgress[]> {
  const data = await loadGuildData()
  const guild = data.guilds.find(g => g.id === guildId)
  if (!guild) return []

  const weekStart = await getWeekStart()

  // Ensure quests exist for this week
  let weekQuests = (data.quests ?? []).filter(q => q.guildId === guildId && q.weekStart === weekStart)
  if (weekQuests.length === 0) {
    weekQuests = generateWeeklyQuests(guildId, weekStart)
    data.quests = [...(data.quests ?? []), ...weekQuests]
    await saveGuildData(data)
  }

  // Calculate progress for each quest
  const results: GuildQuestWithProgress[] = []
  for (const quest of weekQuests) {
    const progress = await calcQuestProgress(quest, guild.memberIds)
    const isComplete = progress >= quest.target
    results.push({ ...quest, progress, isComplete })
  }

  // Auto-distribute rewards for completed quests
  for (const quest of results) {
    if (quest.isComplete) {
      const unclaimedMembers = guild.memberIds.filter(uid => !quest.claimedBy.includes(uid))
      if (unclaimedMembers.length > 0) {
        for (const uid of unclaimedMembers) {
          if (quest.reward.coins > 0) {
            await addCoins({ amount: quest.reward.coins, type: 'MANUAL_ADJUSTMENT', description: `Guild Quest: ${quest.title}`, userId: uid })
          }
          if (quest.reward.xp > 0) {
            await addXP({ amount: quest.reward.xp, source: 'DAILY_CHALLENGE', userId: uid })
          }
          if (quest.reward.gems > 0) {
            await addGems(quest.reward.gems)
          }
        }
        // Mark all members as claimed
        const updatedData = await loadGuildData()
        const qi = updatedData.quests.findIndex(q => q.id === quest.id)
        if (qi !== -1) {
          updatedData.quests[qi].claimedBy = guild.memberIds
          await saveGuildData(updatedData)
          quest.claimedBy = guild.memberIds
        }
      }
    }
  }

  return results
}
