'use server'

import { XPData, XPTransaction, XPTransactionSource, ProjectsData, Project, BossData, getDefaultXPData, getDefaultProjectsData, getDefaultBossData } from '@/lib/types'
import { spawnWeeklyBoss } from '@/lib/gamification'
import { v4 as uuid } from 'uuid'
import { getCurrentUser } from '@/lib/server-helpers'
import { getDb } from '@/lib/db'
import { xpState, xpTransactions, bosses, projects } from '@/lib/db/schema'
import { xpToWire, xpStateToRow, bossToWire, bossToRow, projectToWire } from '@/lib/db/mappers'
import { and, asc, eq, sql } from 'drizzle-orm'
import { addCoins, loadCoinsData } from './data'

async function requireUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

async function loadXPDataFor(userId: string): Promise<XPData> {
  const db = await getDb()
  const [state] = await db.select().from(xpState).where(eq(xpState.userId, userId)).limit(1)
  const txRows = await db.select().from(xpTransactions).where(eq(xpTransactions.userId, userId)).orderBy(asc(xpTransactions.timestamp))
  return xpToWire(state, txRows)
}

async function saveXPStateFor(userId: string, data: XPData): Promise<void> {
  const db = await getDb()
  const row = xpStateToRow(data, userId)
  await db.insert(xpState).values(row).onConflictDoUpdate({
    target: xpState.userId,
    set: { ...row, userId: undefined } as Record<string, unknown>,
  })
}

export async function loadXPData(): Promise<XPData> {
  const userId = await requireUserId()
  if (!userId) return getDefaultXPData()
  return loadXPDataFor(userId)
}

// Persists XP state (counters, unlocks) plus any transactions not yet stored.
// Kept signature-compatible with the JSON-file era.
export async function saveXPData(data: XPData): Promise<void> {
  const userId = await requireUserId()
  if (!userId) return
  await saveXPStateFor(userId, data)
  const db = await getDb()
  if (data.transactions.length > 0) {
    await db.insert(xpTransactions).values(data.transactions.map(t => ({
      id: t.id,
      userId: t.userId ?? userId,
      amount: t.amount,
      source: t.source,
      relatedItemId: t.relatedItemId ?? null,
      timestamp: t.timestamp,
      eventKey: t.eventKey ?? null,
    }))).onConflictDoNothing()
  }
}

export async function addXP({
  amount,
  source,
  relatedItemId,
  userId,
  eventKey,
}: {
  amount: number
  source: XPTransactionSource
  relatedItemId?: string
  userId?: string
  eventKey?: string
}): Promise<XPData> {
  const targetUserId = userId ?? await requireUserId()
  if (!targetUserId) return getDefaultXPData()
  const db = await getDb()
  const transaction: XPTransaction = {
    id: uuid(),
    amount,
    source,
    relatedItemId,
    timestamp: new Date().toISOString(),
    eventKey,
    userId: targetUserId,
  }
  const inserted = await db.insert(xpTransactions).values({
    id: transaction.id,
    userId: targetUserId,
    amount,
    source,
    relatedItemId: relatedItemId ?? null,
    timestamp: transaction.timestamp,
    eventKey: eventKey ?? null,
  }).onConflictDoNothing().returning({ id: xpTransactions.id })
  if (inserted.length > 0) {
    await db.insert(xpState).values({ userId: targetUserId, totalXP: amount }).onConflictDoUpdate({
      target: xpState.userId,
      set: { totalXP: sql`${xpState.totalXP} + ${amount}` },
    })
  }
  return loadXPDataFor(targetUserId)
}

export async function reverseXPReward({
  originalEventKey,
  undoEventKey,
  source,
}: {
  originalEventKey: string
  undoEventKey: string
  source: Extract<XPTransactionSource, 'HABIT_UNDO' | 'TASK_UNDO'>
}): Promise<XPData> {
  const userId = await requireUserId()
  if (!userId) return getDefaultXPData()
  const db = await getDb()
  const [original] = await db.select().from(xpTransactions).where(and(
    eq(xpTransactions.userId, userId),
    eq(xpTransactions.eventKey, originalEventKey),
  )).limit(1)
  if (!original) return loadXPDataFor(userId)
  return addXP({
    amount: -original.amount,
    source,
    relatedItemId: original.relatedItemId ?? undefined,
    eventKey: undoEventKey,
  })
}

export async function unlockAchievement(id: string, xpData: XPData): Promise<XPData> {
  const userId = await requireUserId()
  if (!userId) return xpData
  if (xpData.unlockedAchievements.some(a => a.id === id)) return xpData
  const updated: XPData = {
    ...xpData,
    unlockedAchievements: [...xpData.unlockedAchievements, { id, unlockedAt: new Date().toISOString() }],
  }
  await saveXPStateFor(userId, updated)
  return updated
}

// --- Projects ---

export async function loadProjectsData(): Promise<ProjectsData> {
  const user = await getCurrentUser()
  if (!user) return getDefaultProjectsData()
  const db = await getDb()
  const rows = user.isAdmin
    ? await db.select().from(projects)
    : await db.select().from(projects).where(eq(projects.userId, user.id))
  return { projects: rows.map(projectToWire) }
}

export async function saveProjectsData(data: ProjectsData): Promise<void> {
  const userId = await requireUserId()
  if (!userId) return
  const db = await getDb()
  for (const project of data.projects) {
    const row = {
      id: project.id,
      userId: project.userIds?.[0] ?? userId,
      name: project.name,
      description: project.description ?? '',
      color: project.color,
      emoji: project.emoji ?? null,
      archived: !!project.archived,
      createdAt: project.createdAt,
    }
    await db.insert(projects).values(row).onConflictDoUpdate({
      target: projects.id,
      set: { ...row, userId: undefined, id: undefined } as Record<string, unknown>,
    })
  }
}

export async function createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<ProjectsData> {
  const userId = await requireUserId()
  if (!userId) return getDefaultProjectsData()
  const newProject: Project = {
    ...project,
    id: uuid(),
    createdAt: new Date().toISOString(),
  }
  await saveProjectsData({ projects: [newProject] })
  return loadProjectsData()
}

export async function updateProject(project: Project): Promise<ProjectsData> {
  await saveProjectsData({ projects: [project] })
  return loadProjectsData()
}

export async function deleteProject(id: string): Promise<ProjectsData> {
  const user = await getCurrentUser()
  if (!user) return getDefaultProjectsData()
  const db = await getDb()
  const scope = user.isAdmin
    ? eq(projects.id, id)
    : and(eq(projects.id, id), eq(projects.userId, user.id))
  await db.delete(projects).where(scope)
  return loadProjectsData()
}

// --- Boss (per user) ---

export async function loadBossData(): Promise<BossData> {
  const userId = await requireUserId()
  if (!userId) return getDefaultBossData()
  const db = await getDb()
  const rows = await db.select().from(bosses).where(eq(bosses.userId, userId))
  if (rows.length === 0) return getDefaultBossData()
  // Latest week's boss is "the" boss
  const latest = rows.sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]
  return { boss: bossToWire(latest) }
}

export async function saveBossData(data: BossData): Promise<void> {
  const userId = await requireUserId()
  if (!userId || !data.boss) return
  const db = await getDb()
  const row = bossToRow(data.boss, userId)
  await db.insert(bosses).values(row).onConflictDoUpdate({
    target: bosses.id,
    set: { ...row, userId: undefined, id: undefined } as Record<string, unknown>,
  })
}

// Gets or spawns this week's boss. weekStart is ISO date string (Monday).
export async function getOrSpawnBoss(weekStart: string, habitCount: number): Promise<BossData> {
  const userId = await requireUserId()
  if (!userId) return getDefaultBossData()
  const db = await getDb()
  const existing = await db.select().from(bosses)
    .where(and(eq(bosses.userId, userId), eq(bosses.weekStart, weekStart))).limit(1)
  if (existing[0]) return { boss: bossToWire(existing[0]) }
  const boss = spawnWeeklyBoss(weekStart, habitCount)
  await db.insert(bosses).values(bossToRow(boss, userId)).onConflictDoNothing()
  return { boss }
}

export async function damageBoss(amount: number): Promise<BossData> {
  const data = await loadBossData()
  if (!data.boss || data.boss.isDefeated) return data
  const newHP = Math.max(0, data.boss.currentHP - amount)
  const isDefeated = newHP === 0
  const updated: BossData = {
    boss: { ...data.boss, currentHP: newHP, isDefeated }
  }
  await saveBossData(updated)
  return updated
}

export async function defeatBossAndClaim(): Promise<{ xpData: XPData; bossData: BossData }> {
  const [bossData, xpData] = await Promise.all([loadBossData(), loadXPData()])
  const boss = bossData.boss
  if (!boss || !boss.isDefeated || boss.rewardClaimed) {
    return { xpData, bossData }
  }
  const updatedXP = await addXP({ amount: boss.reward.xp, source: 'MANUAL', relatedItemId: boss.id })
  await addCoins({ amount: boss.reward.coins, description: `Defeated boss: ${boss.name}`, type: 'MANUAL_ADJUSTMENT', relatedItemId: boss.id })
  const finalXP: XPData = { ...updatedXP, bossesDefeated: (updatedXP.bossesDefeated ?? 0) + 1 }
  const userId = await requireUserId()
  if (userId) await saveXPStateFor(userId, finalXP)
  const claimedBossData: BossData = { boss: { ...boss, rewardClaimed: true } }
  await saveBossData(claimedBossData)
  return { xpData: finalXP, bossData: claimedBossData }
}

// --- Gems / shields / boosts / milestones ---

export async function addGems(amount: number, userId?: string): Promise<XPData> {
  const targetUserId = userId ?? await requireUserId()
  if (!targetUserId) return getDefaultXPData()
  const data = await loadXPDataFor(targetUserId)
  const updated: XPData = { ...data, gems: (data.gems ?? 0) + amount }
  await saveXPStateFor(targetUserId, updated)
  return updated
}

export async function buyStreakShield(): Promise<{ xpData: XPData; success: boolean; message: string }> {
  const SHIELD_COST = 75
  const coinsData = await loadCoinsData()
  const balance = coinsData.balance
  if (balance < SHIELD_COST) {
    const xpData = await loadXPData()
    return { xpData, success: false, message: `Need ${SHIELD_COST} coins. You have ${balance}.` }
  }
  const xpData = await loadXPData()
  const MAX_SHIELDS = 3
  const currentShields = xpData.shields ?? 0
  if (currentShields >= MAX_SHIELDS) {
    return { xpData, success: false, message: 'Already at max shields (3).' }
  }
  await addCoins({ amount: -SHIELD_COST, description: 'Bought Streak Shield', type: 'MANUAL_ADJUSTMENT' })
  const userId = await requireUserId()
  const updated: XPData = { ...xpData, shields: currentShields + 1 }
  if (userId) await saveXPStateFor(userId, updated)
  return { xpData: updated, success: true, message: 'Streak Shield purchased!' }
}

export async function consumeShield(dateStr: string, userId?: string): Promise<XPData> {
  const targetUserId = userId ?? await requireUserId()
  if (!targetUserId) return getDefaultXPData()
  const data = await loadXPDataFor(targetUserId)
  if (!data.shields || data.shields <= 0) return data
  if ((data.shieldUsedDates ?? []).includes(dateStr)) return data
  const updated: XPData = {
    ...data,
    shields: data.shields - 1,
    shieldUsedDates: [...(data.shieldUsedDates ?? []), dateStr],
  }
  await saveXPStateFor(targetUserId, updated)
  return updated
}

export async function buyBoost(type: 'xp_2x' | 'coins_2x' | 'gem_boost'): Promise<{ xpData: XPData; success: boolean; message: string }> {
  const BOOST_COSTS: Record<string, number> = { xp_2x: 100, coins_2x: 150, gem_boost: 250 }
  const BOOST_DURATIONS: Record<string, number> = { xp_2x: 24, coins_2x: 24, gem_boost: 12 }
  const cost = BOOST_COSTS[type]
  const coinsData = await loadCoinsData()
  const balance = coinsData.balance
  if (balance < cost) {
    const xpData = await loadXPData()
    return { xpData, success: false, message: `Need ${cost} coins. You have ${balance}.` }
  }
  await addCoins({ amount: -cost, description: `Bought ${type} boost`, type: 'MANUAL_ADJUSTMENT' })
  const xpData = await loadXPData()
  const expiresAt = new Date(Date.now() + BOOST_DURATIONS[type] * 60 * 60 * 1000).toISOString()
  const activeBoosts = (xpData.activeBoosts ?? []).filter(b => b.type !== type && new Date(b.expiresAt) > new Date())
  const updated: XPData = { ...xpData, activeBoosts: [...activeBoosts, { type, expiresAt }] }
  const userId = await requireUserId()
  if (userId) await saveXPStateFor(userId, updated)
  return { xpData: updated, success: true, message: 'Boost activated!' }
}

export async function claimStreakMilestone(habitId: string, milestone: number, bonusCoins: number): Promise<XPData | null> {
  const userId = await requireUserId()
  if (!userId) return null
  const data = await loadXPDataFor(userId)
  const already = (data.milestoneRewards ?? []).some(m => m.habitId === habitId && m.milestone === milestone)
  if (already) return null
  await addCoins({ amount: bonusCoins, description: `Streak milestone: ${milestone} days`, type: 'MANUAL_ADJUSTMENT', relatedItemId: habitId })
  const updated: XPData = {
    ...data,
    milestoneRewards: [...(data.milestoneRewards ?? []), { habitId, milestone, claimedAt: new Date().toISOString() }],
  }
  await saveXPStateFor(userId, updated)
  return updated
}

export async function addPerfectDay(dateStr: string): Promise<XPData> {
  const userId = await requireUserId()
  if (!userId) return getDefaultXPData()
  const data = await loadXPDataFor(userId)
  if ((data.perfectDays ?? []).includes(dateStr)) return data
  const updated: XPData = { ...data, perfectDays: [...(data.perfectDays ?? []), dateStr] }
  await saveXPStateFor(userId, updated)
  return updated
}
