'use server'

import fs from 'fs/promises'
import path from 'path'
import { XPData, XPTransaction, XPTransactionSource, ProjectsData, Project, BossData, getDefaultXPData, getDefaultProjectsData, getDefaultBossData } from '@/lib/types'
import { spawnWeeklyBoss } from '@/lib/gamification'
import { v4 as uuid } from 'uuid'
import { getCurrentUser } from '@/lib/server-helpers'

function getDataDir() {
  return process.env.VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data')
}

async function ensureDataDir() {
  const dataDir = getDataDir()
  try { await fs.access(dataDir) } catch { await fs.mkdir(dataDir, { recursive: true }) }
}

async function readJSON<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDataDir()
  const filePath = path.join(getDataDir(), filename)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

async function writeJSON<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(getDataDir(), filename)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function loadXPData(): Promise<XPData> {
  return readJSON('xp.json', getDefaultXPData())
}

export async function saveXPData(data: XPData): Promise<void> {
  await writeJSON('xp.json', data)
}

export async function addXP({
  amount,
  source,
  relatedItemId,
  userId,
}: {
  amount: number
  source: XPTransactionSource
  relatedItemId?: string
  userId?: string
}): Promise<XPData> {
  const data = await loadXPData()
  const transaction: XPTransaction = {
    id: uuid(),
    amount,
    source,
    relatedItemId,
    timestamp: new Date().toISOString(),
    userId,
  }
  const updated: XPData = {
    ...data,
    totalXP: data.totalXP + amount,
    transactions: [...data.transactions, transaction],
  }
  await saveXPData(updated)
  return updated
}

export async function unlockAchievement(id: string, xpData: XPData): Promise<XPData> {
  if (xpData.unlockedAchievements.some(a => a.id === id)) return xpData
  const updated: XPData = {
    ...xpData,
    unlockedAchievements: [...xpData.unlockedAchievements, { id, unlockedAt: new Date().toISOString() }],
  }
  await saveXPData(updated)
  return updated
}

export async function loadProjectsData(): Promise<ProjectsData> {
  return readJSON('projects.json', getDefaultProjectsData())
}

export async function saveProjectsData(data: ProjectsData): Promise<void> {
  await writeJSON('projects.json', data)
}

export async function createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<ProjectsData> {
  const data = await loadProjectsData()
  const newProject: Project = {
    ...project,
    id: uuid(),
    createdAt: new Date().toISOString(),
  }
  const updated = { projects: [...data.projects, newProject] }
  await saveProjectsData(updated)
  return updated
}

export async function updateProject(project: Project): Promise<ProjectsData> {
  const data = await loadProjectsData()
  const updated = { projects: data.projects.map(p => p.id === project.id ? project : p) }
  await saveProjectsData(updated)
  return updated
}

export async function deleteProject(id: string): Promise<ProjectsData> {
  const data = await loadProjectsData()
  const updated = { projects: data.projects.filter(p => p.id !== id) }
  await saveProjectsData(updated)
  return updated
}

export async function loadBossData(): Promise<BossData> {
  return readJSON('boss.json', getDefaultBossData())
}

export async function saveBossData(data: BossData): Promise<void> {
  await writeJSON('boss.json', data)
}

// Gets or spawns this week's boss. weekStart is ISO date string (Monday).
export async function getOrSpawnBoss(weekStart: string, habitCount: number): Promise<BossData> {
  const data = await loadBossData()
  if (data.boss && data.boss.weekStart === weekStart) return data
  const boss = spawnWeeklyBoss(weekStart, habitCount)
  const updated: BossData = { boss }
  await saveBossData(updated)
  return updated
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

export async function addGems(amount: number): Promise<XPData> {
  const data = await loadXPData()
  const updated: XPData = { ...data, gems: (data.gems ?? 0) + amount }
  await saveXPData(updated)
  return updated
}

export async function buyStreakShield(): Promise<{ xpData: XPData; success: boolean; message: string }> {
  const SHIELD_COST = 75
  const { loadCoinsData, saveCoinsData } = await import('@/app/actions/data')
  const coinsData = await loadCoinsData()
  const balance = coinsData.transactions.reduce((s, t) => s + t.amount, 0)
  if (balance < SHIELD_COST) {
    const xpData = await loadXPData()
    return { xpData, success: false, message: `Need ${SHIELD_COST} coins. You have ${balance}.` }
  }
  // Deduct coins
  const deductTx = { id: uuid(), amount: -SHIELD_COST, type: 'MANUAL_ADJUSTMENT' as const, description: 'Bought Streak Shield', timestamp: new Date().toISOString() }
  await saveCoinsData({ ...coinsData, transactions: [...coinsData.transactions, deductTx] })
  // Add shield
  const xpData = await loadXPData()
  const MAX_SHIELDS = 3
  const currentShields = xpData.shields ?? 0
  if (currentShields >= MAX_SHIELDS) {
    return { xpData, success: false, message: 'Already at max shields (3).' }
  }
  const updated: XPData = { ...xpData, shields: currentShields + 1 }
  await saveXPData(updated)
  return { xpData: updated, success: true, message: 'Streak Shield purchased!' }
}

export async function consumeShield(dateStr: string): Promise<XPData> {
  const data = await loadXPData()
  if (!data.shields || data.shields <= 0) return data
  const updated: XPData = {
    ...data,
    shields: data.shields - 1,
    shieldUsedDates: [...(data.shieldUsedDates ?? []), dateStr],
  }
  await saveXPData(updated)
  return updated
}

export async function buyBoost(type: 'xp_2x' | 'coins_2x' | 'gem_boost'): Promise<{ xpData: XPData; success: boolean; message: string }> {
  const BOOST_COSTS: Record<string, number> = { xp_2x: 100, coins_2x: 150, gem_boost: 250 }
  const BOOST_DURATIONS: Record<string, number> = { xp_2x: 24, coins_2x: 24, gem_boost: 12 }
  const cost = BOOST_COSTS[type]
  const { loadCoinsData, saveCoinsData } = await import('@/app/actions/data')
  const coinsData = await loadCoinsData()
  const balance = coinsData.transactions.reduce((s, t) => s + t.amount, 0)
  if (balance < cost) {
    const xpData = await loadXPData()
    return { xpData, success: false, message: `Need ${cost} coins. You have ${balance}.` }
  }
  const deductTx = { id: uuid(), amount: -cost, type: 'MANUAL_ADJUSTMENT' as const, description: `Bought ${type} boost`, timestamp: new Date().toISOString() }
  await saveCoinsData({ ...coinsData, transactions: [...coinsData.transactions, deductTx] })
  const xpData = await loadXPData()
  const expiresAt = new Date(Date.now() + BOOST_DURATIONS[type] * 60 * 60 * 1000).toISOString()
  const activeBoosts = (xpData.activeBoosts ?? []).filter(b => b.type !== type && new Date(b.expiresAt) > new Date())
  const updated: XPData = { ...xpData, activeBoosts: [...activeBoosts, { type, expiresAt }] }
  await saveXPData(updated)
  return { xpData: updated, success: true, message: 'Boost activated!' }
}

export async function claimStreakMilestone(habitId: string, milestone: number, bonusCoins: number): Promise<XPData | null> {
  const data = await loadXPData()
  const already = (data.milestoneRewards ?? []).some(m => m.habitId === habitId && m.milestone === milestone)
  if (already) return null
  const { addCoins } = await import('@/app/actions/data')
  await addCoins({ amount: bonusCoins, description: `Streak milestone: ${milestone} days`, type: 'MANUAL_ADJUSTMENT', relatedItemId: habitId })
  const updated: XPData = {
    ...data,
    milestoneRewards: [...(data.milestoneRewards ?? []), { habitId, milestone, claimedAt: new Date().toISOString() }],
  }
  await saveXPData(updated)
  return updated
}

export async function addPerfectDay(dateStr: string): Promise<XPData> {
  const data = await loadXPData()
  if ((data.perfectDays ?? []).includes(dateStr)) return data
  const updated: XPData = { ...data, perfectDays: [...(data.perfectDays ?? []), dateStr] }
  await saveXPData(updated)
  return updated
}

export async function defeatBossAndClaim(): Promise<{ xpData: XPData; bossData: BossData }> {
  const [bossData, xpData] = await Promise.all([loadBossData(), loadXPData()])
  const boss = bossData.boss
  if (!boss || !boss.isDefeated || boss.rewardClaimed) {
    return { xpData, bossData }
  }
  const updatedXP = await addXP({ amount: boss.reward.xp, source: 'MANUAL', relatedItemId: boss.id })
  const { addCoins } = await import('@/app/actions/data')
  await addCoins({ amount: boss.reward.coins, description: `Defeated boss: ${boss.name}`, type: 'MANUAL_ADJUSTMENT', relatedItemId: boss.id })
  const finalXP: XPData = { ...updatedXP, bossesDefeated: (updatedXP.bossesDefeated ?? 0) + 1 }
  await saveXPData(finalXP)
  const claimedBossData: BossData = { boss: { ...boss, rewardClaimed: true } }
  await saveBossData(claimedBossData)
  return { xpData: finalXP, bossData: claimedBossData }
}
