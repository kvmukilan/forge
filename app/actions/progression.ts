'use server'

import { and, asc, eq, gte } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import {
  attributeTransactions,
  completions,
  habits,
  progressionProfiles,
  questFeedback,
  userSettings,
  xpState,
} from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/server-helpers'
import { getLevelFromXP } from '@/lib/gamification'
import { uuid } from '@/lib/utils'
import {
  ATTRIBUTE_KEYS,
  assessStartingAttributes,
  generateStarterProgram,
  getAttributeProgress,
  getAttributeRewardForDifficulty,
  getCampaignState,
  getPrimaryAttributeForCategory,
  getRankForLevel,
  normalizeAttributeScores,
  recommendAdaptation,
  type AssessmentResponses,
  type AttributeExplanations,
  type AttributeKey,
  type AttributeProgress,
  type AttributeScores,
  type CampaignState,
  type EffortFeedback,
  type ProgramRecommendation,
  type ProgressionPace,
} from '@/lib/progression'
import type { Habit, HabitCategory, Settings } from '@/lib/types'
import { isHabitDue } from '@/lib/utils'
import { recordProductEvent } from '@/lib/product-analytics'

const attributeKeySchema = z.enum(ATTRIBUTE_KEYS)
const attributeScoresSchema = z.object({
  strength: z.number().int().min(1).max(10),
  vitality: z.number().int().min(1).max(10),
  focus: z.number().int().min(1).max(10),
  wisdom: z.number().int().min(1).max(10),
  discipline: z.number().int().min(1).max(10),
  connection: z.number().int().min(1).max(10),
})
const assessmentSchema = z.object({
  focusAreas: z.array(attributeKeySchema).max(6),
  baselines: attributeScoresSchema,
  consistency: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  weekdayMinutes: z.number().int().min(5).max(240),
  weekendMinutes: z.number().int().min(5).max(360),
  preferredTime: z.enum(['morning', 'afternoon', 'evening', 'flexible']),
  pace: z.enum(['gentle', 'balanced', 'challenging']),
  motivation: z.enum(['visible_progress', 'rewards', 'structure', 'accountability']),
  restDays: z.array(z.number().int().min(0).max(6)).max(7),
  constraints: z.string().max(500),
})
const recommendationSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  frequency: z.string().min(1).max(200),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.enum(['fitness', 'learning', 'mindfulness', 'social', 'creative', 'productivity', 'health', 'other']),
  primaryAttribute: attributeKeySchema,
  secondaryAttribute: attributeKeySchema.nullable(),
  estimatedMinutes: z.number().int().min(1).max(240),
  coinReward: z.number().int().min(1).max(30),
  attributeReward: z.number().int().min(1).max(50),
  reason: z.string().trim().max(300),
})
const onboardingSchema = z.object({
  responses: assessmentSchema,
  attributes: attributeScoresSchema,
  recommendations: z.array(recommendationSchema).min(1).max(5),
})

async function getTimezoneForUser(userId: string): Promise<string> {
  const db = await getDb()
  const [row] = await db.select({ data: userSettings.data }).from(userSettings)
    .where(eq(userSettings.userId, userId)).limit(1)
  const timezone = (row?.data as Settings | undefined)?.system?.timezone ?? 'UTC'
  return DateTime.now().setZone(timezone).isValid ? timezone : 'UTC'
}

export interface ProgressionProfileWire {
  assessmentVersion: number
  onboardingCompleted: boolean
  responses: Partial<AssessmentResponses>
  baseAttributes: AttributeScores
  explanations: Partial<AttributeExplanations>
  preferredPace: ProgressionPace
  weekdayMinutes: number
  weekendMinutes: number
  preferredTime: AssessmentResponses['preferredTime']
  restDays: number[]
  adaptationEnabled: boolean
  campaignStartedOn: string | null
  completedAt: string | null
}

export interface ProgressionSummary {
  profile: ProgressionProfileWire
  attributes: Record<AttributeKey, AttributeProgress>
  totalAttributeXP: number
  overallLevel: number
  rank: { name: string; nextAt: number | null }
  campaign: CampaignState
}

function profileToWire(row: typeof progressionProfiles.$inferSelect): ProgressionProfileWire {
  return {
    assessmentVersion: row.assessmentVersion,
    onboardingCompleted: row.onboardingCompleted,
    responses: row.responses ?? {},
    baseAttributes: normalizeAttributeScores(row.baseAttributes),
    explanations: row.explanations ?? {},
    preferredPace: row.preferredPace as ProgressionPace,
    weekdayMinutes: row.weekdayMinutes,
    weekendMinutes: row.weekendMinutes,
    preferredTime: row.preferredTime as AssessmentResponses['preferredTime'],
    restDays: Array.isArray(row.restDays) ? row.restDays : [],
    adaptationEnabled: row.adaptationEnabled,
    campaignStartedOn: row.campaignStartedOn,
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}

export async function getProgressionSummary(): Promise<ProgressionSummary | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDb()
  const [profile] = await db.select().from(progressionProfiles)
    .where(eq(progressionProfiles.userId, user.id)).limit(1)
  if (!profile) return null

  const [transactions, state] = await Promise.all([
    db.select({ attribute: attributeTransactions.attribute, amount: attributeTransactions.amount })
      .from(attributeTransactions)
      .where(eq(attributeTransactions.userId, user.id)),
    db.select({ totalXP: xpState.totalXP }).from(xpState).where(eq(xpState.userId, user.id)).limit(1),
  ])
  const earned = Object.fromEntries(ATTRIBUTE_KEYS.map(key => [key, 0])) as Record<AttributeKey, number>
  for (const transaction of transactions) {
    if (ATTRIBUTE_KEYS.includes(transaction.attribute as AttributeKey)) {
      earned[transaction.attribute as AttributeKey] += transaction.amount
    }
  }
  const base = normalizeAttributeScores(profile.baseAttributes)
  const attributes = Object.fromEntries(ATTRIBUTE_KEYS.map(key => [
    key,
    getAttributeProgress(key, base[key], earned[key]),
  ])) as Record<AttributeKey, AttributeProgress>
  const overallLevel = getLevelFromXP(state[0]?.totalXP ?? 0)

  return {
    profile: profileToWire(profile),
    attributes,
    totalAttributeXP: Object.values(earned).reduce((sum, value) => sum + Math.max(0, value), 0),
    overallLevel,
    rank: getRankForLevel(overallLevel),
    campaign: getCampaignState(profile.campaignStartedOn),
  }
}

export async function previewAssessment(input: unknown): Promise<{
  responses: AssessmentResponses
  attributes: AttributeScores
  explanations: AttributeExplanations
  recommendations: ProgramRecommendation[]
}> {
  const responses = assessmentSchema.parse(input) as AssessmentResponses
  const assessment = assessStartingAttributes(responses)
  return {
    responses,
    ...assessment,
    recommendations: generateStarterProgram(responses),
  }
}

export async function finalizeOnboarding(input: unknown): Promise<ProgressionSummary> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const parsed = onboardingSchema.parse(input)
  const responses = parsed.responses as AssessmentResponses
  const serverAssessment = assessStartingAttributes(responses)
  const attributes = normalizeAttributeScores(parsed.attributes)
  const explanations = { ...serverAssessment.explanations }
  for (const key of ATTRIBUTE_KEYS) {
    if (attributes[key] !== serverAssessment.attributes[key]) {
      explanations[key] = [...explanations[key], `You adjusted the starting estimate to ${attributes[key]}/10.`]
    }
  }

  const db = await getDb()
  const [previousProfile] = await db.select({ userId: progressionProfiles.userId }).from(progressionProfiles)
    .where(eq(progressionProfiles.userId, user.id)).limit(1)
  const now = new Date()
  const timezone = await getTimezoneForUser(user.id)
  const today = DateTime.now().setZone(timezone).toISODate()!
  await db.insert(progressionProfiles).values({
    userId: user.id,
    assessmentVersion: 1,
    onboardingCompleted: true,
    responses,
    baseAttributes: attributes,
    explanations,
    preferredPace: responses.pace,
    weekdayMinutes: responses.weekdayMinutes,
    weekendMinutes: responses.weekendMinutes,
    preferredTime: responses.preferredTime,
    restDays: [...new Set(responses.restDays)].sort(),
    adaptationEnabled: true,
    campaignStartedOn: today,
    completedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: progressionProfiles.userId,
    set: {
      assessmentVersion: 1,
      onboardingCompleted: true,
      responses,
      baseAttributes: attributes,
      explanations,
      preferredPace: responses.pace,
      weekdayMinutes: responses.weekdayMinutes,
      weekendMinutes: responses.weekendMinutes,
      preferredTime: responses.preferredTime,
      restDays: [...new Set(responses.restDays)].sort(),
      adaptationEnabled: true,
      completedAt: now,
      updatedAt: now,
    },
  })

  const existingKeystone = await db.select({ id: habits.id }).from(habits)
    .where(and(eq(habits.userId, user.id), eq(habits.isKeystone, true))).limit(1)
  for (const [index, recommendation] of parsed.recommendations.entries()) {
    const stableId = `${user.id}:assessment:${recommendation.id}`
    const reward = getAttributeRewardForDifficulty(recommendation.difficulty)
    await db.insert(habits).values({
      id: stableId,
      userId: user.id,
      name: recommendation.name,
      description: recommendation.description,
      frequency: recommendation.frequency,
      coinReward: recommendation.difficulty === 'hard' ? 15 : recommendation.difficulty === 'medium' ? 10 : 5,
      targetCompletions: 1,
      difficulty: recommendation.difficulty,
      category: recommendation.category,
      isKeystone: existingKeystone.length === 0 && index === 0,
      primaryAttribute: recommendation.primaryAttribute,
      secondaryAttribute: recommendation.secondaryAttribute,
      attributeReward: reward,
      progressionOrigin: 'assessment',
      adaptiveEnabled: true,
      adaptationLevel: 0,
      estimatedMinutes: recommendation.estimatedMinutes,
      recommendationReason: recommendation.reason,
    }).onConflictDoNothing()
  }
  await recordProductEvent(user.id, previousProfile ? 'assessment_retaken' : 'onboarding_completed', {
    assessment_version: 1,
    recommendation_count: parsed.recommendations.length,
  })

  const summary = await getProgressionSummary()
  if (!summary) throw new Error('Progression profile could not be loaded')
  return summary
}

export async function awardAttributeProgress(input: unknown): Promise<ProgressionSummary | null> {
  const parsed = z.object({
    habitId: z.string().min(1).max(200),
    completionAt: z.string().datetime(),
  }).parse(input)
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const db = await getDb()
  const [ownedCompletion] = await db.select({
    habit: habits,
    completedAt: completions.completedAt,
  }).from(completions)
    .innerJoin(habits, and(eq(completions.habitId, habits.id), eq(habits.userId, user.id)))
    .where(and(
      eq(completions.userId, user.id),
      eq(completions.habitId, parsed.habitId),
      eq(completions.completedAt, parsed.completionAt),
    )).limit(1)
  if (!ownedCompletion) throw new Error('Completion not found')

  const habit = ownedCompletion.habit
  const primary = (habit.primaryAttribute as AttributeKey | null)
    ?? getPrimaryAttributeForCategory(habit.category as HabitCategory | null)
  const secondary = habit.secondaryAttribute as AttributeKey | null
  const baseReward = habit.attributeReward || getAttributeRewardForDifficulty(habit.difficulty as 'easy' | 'medium' | 'hard' | null)
  const eventKey = `completion:${habit.id}:${parsed.completionAt}`
  const rewards = [
    { attribute: primary, amount: baseReward },
    ...(secondary && secondary !== primary ? [{ attribute: secondary, amount: Math.max(1, Math.round(baseReward * 0.4)) }] : []),
  ]
  for (const reward of rewards) {
    await db.insert(attributeTransactions).values({
      id: uuid(),
      userId: user.id,
      attribute: reward.attribute,
      amount: reward.amount,
      source: 'completion',
      eventKey,
      relatedHabitId: habit.id,
      completionAt: parsed.completionAt,
    }).onConflictDoNothing()
  }
  return getProgressionSummary()
}

export async function revokeAttributeProgress(input: unknown): Promise<ProgressionSummary | null> {
  const parsed = z.object({
    habitId: z.string().min(1).max(200),
    completionAt: z.string().datetime(),
  }).parse(input)
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const db = await getDb()
  const originalEventKey = `completion:${parsed.habitId}:${parsed.completionAt}`
  const originalRewards = await db.select().from(attributeTransactions).where(and(
    eq(attributeTransactions.userId, user.id),
    eq(attributeTransactions.eventKey, originalEventKey),
    eq(attributeTransactions.source, 'completion'),
  ))
  const undoEventKey = `undo:${parsed.habitId}:${parsed.completionAt}`
  for (const reward of originalRewards) {
    await db.insert(attributeTransactions).values({
      id: uuid(),
      userId: user.id,
      attribute: reward.attribute,
      amount: -reward.amount,
      source: 'undo',
      eventKey: undoEventKey,
      relatedHabitId: reward.relatedHabitId,
      completionAt: parsed.completionAt,
    }).onConflictDoNothing()
  }
  return getProgressionSummary()
}

export async function saveQuestFeedback(input: unknown): Promise<void> {
  const parsed = z.object({
    habitId: z.string().min(1).max(200),
    completionAt: z.string().datetime(),
    rating: z.enum(['too_easy', 'right', 'too_hard']),
  }).parse(input) as { habitId: string; completionAt: string; rating: EffortFeedback }
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const db = await getDb()
  const [ownedCompletion] = await db.select({ completedAt: completions.completedAt }).from(completions)
    .where(and(
      eq(completions.userId, user.id),
      eq(completions.habitId, parsed.habitId),
      eq(completions.completedAt, parsed.completionAt),
    )).limit(1)
  if (!ownedCompletion) throw new Error('Completion not found')
  const now = new Date()
  await db.insert(questFeedback).values({
    id: uuid(),
    userId: user.id,
    habitId: parsed.habitId,
    completionAt: parsed.completionAt,
    rating: parsed.rating,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [questFeedback.userId, questFeedback.habitId, questFeedback.completionAt],
    set: { rating: parsed.rating, updatedAt: now },
  })
}

export async function updateHabitProgression(input: unknown): Promise<void> {
  const parsed = z.object({
    habitId: z.string().min(1).max(200),
    primaryAttribute: attributeKeySchema,
    secondaryAttribute: attributeKeySchema.nullable(),
    adaptiveEnabled: z.boolean(),
    adaptationLevel: z.number().int().min(-2).max(2),
    pausedUntil: z.string().date().nullable(),
  }).parse(input)
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const db = await getDb()
  const [current] = await db.select({ adaptationLevel: habits.adaptationLevel }).from(habits)
    .where(and(eq(habits.id, parsed.habitId), eq(habits.userId, user.id))).limit(1)
  if (!current) throw new Error('Habit not found')
  await db.update(habits).set({
    primaryAttribute: parsed.primaryAttribute,
    secondaryAttribute: parsed.secondaryAttribute,
    adaptiveEnabled: parsed.adaptiveEnabled,
    adaptationLevel: parsed.adaptationLevel,
    pausedUntil: parsed.pausedUntil,
    ...(current.adaptationLevel !== parsed.adaptationLevel && { lastAdaptedAt: new Date() }),
  }).where(and(eq(habits.id, parsed.habitId), eq(habits.userId, user.id)))
}

export interface HabitAdaptationRecommendation {
  habitId: string
  habitName: string
  action: 'increase' | 'recover'
  currentLevel: number
  nextLevel: number
  reason: string
  completionRate: number
  currentMinutes: number | null
  proposedMinutes: number | null
  currentDifficulty: 'easy' | 'medium' | 'hard'
  proposedDifficulty: 'easy' | 'medium' | 'hard'
}

function stepDifficulty(
  difficulty: 'easy' | 'medium' | 'hard',
  direction: 'increase' | 'recover',
): 'easy' | 'medium' | 'hard' {
  const values = ['easy', 'medium', 'hard'] as const
  const index = values.indexOf(difficulty)
  return values[Math.min(2, Math.max(0, index + (direction === 'increase' ? 1 : -1)))]
}

export async function getAdaptationRecommendations(): Promise<HabitAdaptationRecommendation[]> {
  const user = await getCurrentUser()
  if (!user) return []
  const db = await getDb()
  const timezone = await getTimezoneForUser(user.id)
  const today = DateTime.now().setZone(timezone).startOf('day')
  const cutoff = today.minus({ days: 13 })
  const [profile, habitRows, completionRows, feedbackRows] = await Promise.all([
    db.select().from(progressionProfiles).where(eq(progressionProfiles.userId, user.id)).limit(1),
    db.select().from(habits).where(and(eq(habits.userId, user.id), eq(habits.archived, false), eq(habits.isTask, false))),
    db.select().from(completions).where(and(
      eq(completions.userId, user.id),
      gte(completions.completedAt, cutoff.toISO()!),
    )),
    db.select().from(questFeedback).where(and(
      eq(questFeedback.userId, user.id),
      gte(questFeedback.createdAt, cutoff.toJSDate()),
    )),
  ])
  if (!profile[0]?.onboardingCompleted) return []

  const recommendations: HabitAdaptationRecommendation[] = []
  for (const row of habitRows) {
    const habitCompletions = completionRows.filter(item => item.habitId === row.id)
    const habit: Habit = {
      id: row.id,
      name: row.name,
      description: row.description,
      frequency: row.frequency,
      coinReward: row.coinReward,
      targetCompletions: row.targetCompletions ?? 1,
      completions: habitCompletions.map(item => item.completedAt),
      difficulty: (row.difficulty as Habit['difficulty']) ?? 'easy',
      category: row.category as HabitCategory | undefined,
    }
    const createdOn = DateTime.fromJSDate(row.createdAt).setZone(timezone).startOf('day')
    const evidenceStart = createdOn > cutoff ? createdOn : cutoff
    const evidenceDays = Math.min(14, Math.max(1, Math.floor(today.diff(evidenceStart, 'days').days) + 1))
    const dueDates = Array.from({ length: evidenceDays }, (_, index) => evidenceStart.plus({ days: index }))
      .filter(date => isHabitDue({ habit, timezone, date }))
    const completedDates = new Set<string>()
    for (const date of dueDates) {
      const dateKey = date.toISODate()!
      const count = habitCompletions.filter(item => DateTime.fromISO(item.completedAt).setZone(timezone).toISODate() === dateKey).length
      if (count >= (row.targetCompletions ?? 1)) completedDates.add(dateKey)
    }
    let recentMisses = 0
    for (const date of [...dueDates].reverse()) {
      if (completedDates.has(date.toISODate()!)) break
      recentMisses++
    }
    const feedback = feedbackRows.filter(item => item.habitId === row.id)
    const currentDifficulty = (row.difficulty as 'easy' | 'medium' | 'hard' | null) ?? 'easy'
    const daysSinceLastChange = row.lastAdaptedAt
      ? Math.floor(today.diff(DateTime.fromJSDate(row.lastAdaptedAt).setZone(timezone).startOf('day'), 'days').days)
      : 999
    const recommendation = recommendAdaptation({
      enabled: profile[0].adaptationEnabled && row.adaptiveEnabled,
      paused: !!row.pausedUntil && row.pausedUntil >= today.toISODate()!,
      opportunities: dueDates.length,
      completions: completedDates.size,
      tooEasy: feedback.filter(item => item.rating === 'too_easy').length,
      appropriate: feedback.filter(item => item.rating === 'right').length,
      tooHard: feedback.filter(item => item.rating === 'too_hard').length,
      recentMisses,
      currentLevel: row.adaptationLevel,
      daysSinceLastChange,
    })
    if (recommendation.action === 'hold') continue
    const direction = recommendation.action
    const proposedDifficulty = stepDifficulty(currentDifficulty, direction)
    const currentMinutes = row.estimatedMinutes
    const proposedMinutes = currentMinutes == null ? null : direction === 'increase'
      ? Math.min(120, Math.max(currentMinutes + 1, Math.round(currentMinutes * 1.15)))
      : Math.max(5, Math.min(currentMinutes - 1, Math.round(currentMinutes * 0.8)))
    recommendations.push({
      habitId: row.id,
      habitName: row.name,
      action: recommendation.action,
      currentLevel: row.adaptationLevel,
      nextLevel: recommendation.nextLevel,
      reason: recommendation.reason,
      completionRate: dueDates.length ? Math.round((completedDates.size / dueDates.length) * 100) : 0,
      currentMinutes,
      proposedMinutes,
      currentDifficulty,
      proposedDifficulty,
    })
  }

  return recommendations
    .sort((a, b) => (a.action === b.action ? a.habitName.localeCompare(b.habitName) : a.action === 'recover' ? -1 : 1))
    .slice(0, 1)
}

export async function acceptAdaptation(input: unknown): Promise<void> {
  const parsed = z.object({
    habitId: z.string().min(1).max(200),
    nextLevel: z.number().int().min(-2).max(2),
  }).parse(input)
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const db = await getDb()
  const [row] = await db.select().from(habits)
    .where(and(eq(habits.id, parsed.habitId), eq(habits.userId, user.id))).limit(1)
  if (!row) throw new Error('Habit not found')
  if (Math.abs(parsed.nextLevel - row.adaptationLevel) !== 1) throw new Error('Adaptation must change one step at a time')
  const direction = parsed.nextLevel > row.adaptationLevel ? 'increase' : 'recover'
  const currentDifficulty = (row.difficulty as 'easy' | 'medium' | 'hard' | null) ?? 'easy'
  const nextDifficulty = stepDifficulty(currentDifficulty, direction)
  const nextMinutes = row.estimatedMinutes == null ? null : direction === 'increase'
    ? Math.min(120, Math.max(row.estimatedMinutes + 1, Math.round(row.estimatedMinutes * 1.15)))
    : Math.max(5, Math.min(row.estimatedMinutes - 1, Math.round(row.estimatedMinutes * 0.8)))
  await db.update(habits).set({
    adaptationLevel: parsed.nextLevel,
    difficulty: nextDifficulty,
    estimatedMinutes: nextMinutes,
    attributeReward: getAttributeRewardForDifficulty(nextDifficulty),
    lastAdaptedAt: new Date(),
  }).where(and(eq(habits.id, parsed.habitId), eq(habits.userId, user.id)))
  await recordProductEvent(user.id, 'adaptation_accepted', {
    direction,
    from_level: row.adaptationLevel,
    to_level: parsed.nextLevel,
  })
}

export async function dismissAdaptation(input: unknown): Promise<void> {
  const parsed = z.object({ habitId: z.string().min(1).max(200) }).parse(input)
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const db = await getDb()
  await db.update(habits).set({ lastAdaptedAt: new Date() })
    .where(and(eq(habits.id, parsed.habitId), eq(habits.userId, user.id)))
  await recordProductEvent(user.id, 'adaptation_kept')
}

export async function getAttributeEventAudit(limit = 50): Promise<Array<{
  attribute: AttributeKey
  amount: number
  source: string
  completionAt: string | null
  createdAt: string
}>> {
  const user = await getCurrentUser()
  if (!user) return []
  const db = await getDb()
  const rows = await db.select({
    attribute: attributeTransactions.attribute,
    amount: attributeTransactions.amount,
    source: attributeTransactions.source,
    completionAt: attributeTransactions.completionAt,
    createdAt: attributeTransactions.createdAt,
  }).from(attributeTransactions)
    .where(eq(attributeTransactions.userId, user.id))
    .orderBy(asc(attributeTransactions.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200))
  return rows
    .filter(row => ATTRIBUTE_KEYS.includes(row.attribute as AttributeKey))
    .map(row => ({ ...row, attribute: row.attribute as AttributeKey, createdAt: row.createdAt.toISOString() }))
}
