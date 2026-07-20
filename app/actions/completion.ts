'use server'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import {
  attributeTransactions,
  coinTransactions,
  completions,
  habits,
  questFeedback,
  productEvents,
  userSettings,
  xpState,
  xpTransactions,
} from '@/lib/db/schema'
import { loadCoinsData } from '@/app/actions/data'
import { loadXPData } from '@/app/actions/gamification'
import { calculateHabitXP, calculateStreak } from '@/lib/gamification'
import { getCurrentSeason } from '@/lib/seasons'
import { getUnlockedBonusForCategory } from '@/lib/skill-trees'
import { getAttributeRewardForDifficulty, getPrimaryAttributeForCategory, type AttributeKey } from '@/lib/progression'
import { getCurrentUser } from '@/lib/server-helpers'
import type { CoinsData, Habit, HabitCategory, Settings, XPBoost, XPData } from '@/lib/types'
import { uuid } from '@/lib/utils'

const completionInput = z.object({
  habitId: z.string().min(1).max(200),
  completionAt: z.string().datetime(),
})

export interface CompletionRewardResult {
  inserted: boolean
  targetReached: boolean
  coinAmount: number
  xpAmount: number
  coins: CoinsData
  xp: XPData
}

function validTimezone(settings: unknown): string {
  const timezone = (settings as Settings | undefined)?.system?.timezone ?? 'UTC'
  return DateTime.now().setZone(timezone).isValid ? timezone : 'UTC'
}

function activeBoosts(state: typeof xpState.$inferSelect | undefined, now: Date): XPBoost[] {
  const boosts = Array.isArray(state?.activeBoosts) ? state.activeBoosts as XPBoost[] : []
  return boosts.filter(boost => new Date(boost.expiresAt) > now)
}

function rowToHabit(row: typeof habits.$inferSelect, completionTimes: string[]): Habit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    frequency: row.frequency,
    coinReward: row.coinReward,
    targetCompletions: row.targetCompletions ?? 1,
    completions: completionTimes,
    isTask: row.isTask,
    archived: row.archived,
    difficulty: (row.difficulty as Habit['difficulty']) ?? 'medium',
    category: row.category as HabitCategory | undefined,
    isKeystone: row.isKeystone,
  }
}

async function loadResult(
  inserted: boolean,
  targetReached: boolean,
  coinAmount: number,
  xpAmount: number,
): Promise<CompletionRewardResult> {
  const [coins, xp] = await Promise.all([loadCoinsData(), loadXPData()])
  return { inserted, targetReached, coinAmount, xpAmount, coins, xp }
}

export async function completeHabitWithRewards(input: unknown): Promise<CompletionRewardResult> {
  const parsed = completionInput.parse(input)
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const db = await getDb()

  const outcome = await db.transaction(async tx => {
    const [habitRow] = await tx.select().from(habits)
      .where(and(eq(habits.id, parsed.habitId), eq(habits.userId, user.id)))
      .limit(1)
      .for('update')
    if (!habitRow) throw new Error('Habit not found')

    const [settingsRow, state] = await Promise.all([
      tx.select({ data: userSettings.data }).from(userSettings).where(eq(userSettings.userId, user.id)).limit(1),
      tx.select().from(xpState).where(eq(xpState.userId, user.id)).limit(1),
    ])
    const timezone = validTimezone(settingsRow[0]?.data)
    const completionDate = DateTime.fromISO(parsed.completionAt).setZone(timezone)
    const today = DateTime.now().setZone(timezone)
    if (!completionDate.isValid || completionDate.toISODate() !== today.toISODate()) {
      throw new Error('Today completions must use the current local date')
    }

    const completionRows = await tx.select({ completedAt: completions.completedAt }).from(completions)
      .where(and(eq(completions.userId, user.id), eq(completions.habitId, habitRow.id)))
    if (completionRows.some(row => row.completedAt === parsed.completionAt)) {
      return { inserted: false, targetReached: false, coinAmount: 0, xpAmount: 0 }
    }
    const localDay = completionDate.toISODate()!
    const completionsToday = completionRows.filter(row =>
      DateTime.fromISO(row.completedAt).setZone(timezone).toISODate() === localDay,
    ).length
    const target = habitRow.targetCompletions ?? 1
    if (completionsToday >= target) {
      return { inserted: false, targetReached: false, coinAmount: 0, xpAmount: 0 }
    }

    const inserted = await tx.insert(completions).values({
      habitId: habitRow.id,
      userId: user.id,
      completedAt: parsed.completionAt,
    }).onConflictDoNothing().returning({ completedAt: completions.completedAt })
    if (inserted.length === 0) {
      return { inserted: false, targetReached: false, coinAmount: 0, xpAmount: 0 }
    }
    const targetReached = completionsToday + 1 === target
    if (!targetReached) return { inserted: true, targetReached: false, coinAmount: 0, xpAmount: 0 }

    const currentState = state[0]
    const unlockedSkills = Array.isArray(currentState?.unlockedSkills) ? currentState.unlockedSkills as string[] : []
    const skillBonus = getUnlockedBonusForCategory((habitRow.category as HabitCategory | null) ?? 'other', unlockedSkills)
    const boosts = activeBoosts(currentState, new Date())
    const season = getCurrentSeason()
    const coinAmount = Math.round(
      habitRow.coinReward
      * (boosts.some(boost => boost.type === 'coins_2x') ? 2 : 1)
      * (1 + season.coinBonus / 100)
      * (1 + skillBonus.coinBonusPct / 100),
    )

    const allHabitRows = await tx.select().from(habits).where(and(
      eq(habits.userId, user.id),
      eq(habits.isKeystone, true),
      eq(habits.archived, false),
    ))
    const keystoneIds = allHabitRows.map(row => row.id)
    const keystoneCompletions = keystoneIds.length > 0
      ? await tx.select().from(completions).where(and(
          eq(completions.userId, user.id),
          inArray(completions.habitId, keystoneIds),
        ))
      : []
    const keystoneWasComplete = allHabitRows.some(row => {
      const count = keystoneCompletions.filter(completion =>
        completion.habitId === row.id
        && completion.completedAt !== parsed.completionAt
        && DateTime.fromISO(completion.completedAt).setZone(timezone).toISODate() === localDay,
      ).length
      return count >= (row.targetCompletions ?? 1)
    })
    const habit = rowToHabit(habitRow, [...completionRows.map(row => row.completedAt), parsed.completionAt])
    const streak = calculateStreak(habit, timezone, (currentState?.shieldUsedDates as string[] | undefined) ?? [])
    const baseXP = calculateHabitXP(habit)
    const bonusXP = streak >= 7 ? Math.round(baseXP * 0.5) : 0
    const xpAmount = Math.round(
      (baseXP + bonusXP)
      * (boosts.some(boost => boost.type === 'xp_2x') ? 2 : 1)
      * (keystoneWasComplete ? 1.25 : 1)
      * (1 + season.xpBonus / 100)
      * (1 + skillBonus.xpBonusPct / 100),
    )
    const eventKey = `completion:${habitRow.id}:${parsed.completionAt}`

    await tx.insert(coinTransactions).values({
      id: uuid(),
      userId: user.id,
      amount: coinAmount,
      type: habitRow.isTask ? 'TASK_COMPLETION' : 'HABIT_COMPLETION',
      description: `Completed: ${habitRow.name}`,
      timestamp: parsed.completionAt,
      relatedItemId: habitRow.id,
      eventKey: `${eventKey}:coins`,
    }).onConflictDoNothing()

    const insertedXP = await tx.insert(xpTransactions).values({
      id: uuid(),
      userId: user.id,
      amount: xpAmount,
      source: habitRow.isTask ? 'TASK_COMPLETION' : 'HABIT_COMPLETION',
      relatedItemId: habitRow.id,
      timestamp: parsed.completionAt,
      eventKey: `${eventKey}:xp`,
    }).onConflictDoNothing().returning({ id: xpTransactions.id })
    if (insertedXP.length > 0) {
      await tx.insert(xpState).values({ userId: user.id, totalXP: xpAmount }).onConflictDoUpdate({
        target: xpState.userId,
        set: { totalXP: sql`${xpState.totalXP} + ${xpAmount}` },
      })
    }

    const primary = (habitRow.primaryAttribute as AttributeKey | null)
      ?? getPrimaryAttributeForCategory(habitRow.category as HabitCategory | null)
    const secondary = habitRow.secondaryAttribute as AttributeKey | null
    const baseAttributeReward = habitRow.attributeReward
      || getAttributeRewardForDifficulty(habitRow.difficulty as Habit['difficulty'])
    const rewards = [
      { attribute: primary, amount: baseAttributeReward },
      ...(secondary && secondary !== primary
        ? [{ attribute: secondary, amount: Math.max(1, Math.round(baseAttributeReward * 0.4)) }]
        : []),
    ]
    for (const reward of rewards) {
      await tx.insert(attributeTransactions).values({
        id: uuid(),
        userId: user.id,
        attribute: reward.attribute,
        amount: reward.amount,
        source: 'completion',
        eventKey,
        relatedHabitId: habitRow.id,
        completionAt: parsed.completionAt,
      }).onConflictDoNothing()
    }
    await tx.insert(productEvents).values({
      id: uuid(),
      userId: user.id,
      name: 'quest_completed',
      properties: {
        category: (habitRow.category as string | null) ?? 'other',
        difficulty: (habitRow.difficulty as string | null) ?? 'medium',
        is_task: habitRow.isTask,
      },
    })
    if (habitRow.isTask) {
      await tx.update(habits).set({ archived: true }).where(and(eq(habits.id, habitRow.id), eq(habits.userId, user.id)))
    }
    return { inserted: true, targetReached: true, coinAmount, xpAmount }
  })

  return loadResult(outcome.inserted, outcome.targetReached, outcome.coinAmount, outcome.xpAmount)
}

export async function undoHabitWithRewards(input: unknown): Promise<CompletionRewardResult> {
  const parsed = completionInput.parse(input)
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const db = await getDb()

  const outcome = await db.transaction(async tx => {
    const [habitRow] = await tx.select().from(habits)
      .where(and(eq(habits.id, parsed.habitId), eq(habits.userId, user.id)))
      .limit(1)
      .for('update')
    if (!habitRow) throw new Error('Habit not found')
    const [settingsRow] = await tx.select({ data: userSettings.data }).from(userSettings)
      .where(eq(userSettings.userId, user.id)).limit(1)
    const timezone = validTimezone(settingsRow?.data)
    const localDay = DateTime.fromISO(parsed.completionAt).setZone(timezone).toISODate()
    const allCompletions = await tx.select().from(completions).where(and(
      eq(completions.userId, user.id),
      eq(completions.habitId, habitRow.id),
    ))
    if (!allCompletions.some(completion => completion.completedAt === parsed.completionAt)) {
      return { inserted: false, targetReached: false, coinAmount: 0, xpAmount: 0 }
    }
    const countBefore = allCompletions.filter(completion =>
      DateTime.fromISO(completion.completedAt).setZone(timezone).toISODate() === localDay,
    ).length
    const targetReached = countBefore === (habitRow.targetCompletions ?? 1)
    await tx.delete(completions).where(and(
      eq(completions.userId, user.id),
      eq(completions.habitId, habitRow.id),
      eq(completions.completedAt, parsed.completionAt),
    ))
    await tx.delete(questFeedback).where(and(
      eq(questFeedback.userId, user.id),
      eq(questFeedback.habitId, habitRow.id),
      eq(questFeedback.completionAt, parsed.completionAt),
    ))
    if (!targetReached) return { inserted: true, targetReached: false, coinAmount: 0, xpAmount: 0 }

    const eventKey = `completion:${habitRow.id}:${parsed.completionAt}`
    const undoKey = `undo:${habitRow.id}:${parsed.completionAt}`
    const [coinReward] = await tx.select().from(coinTransactions).where(and(
      eq(coinTransactions.userId, user.id),
      eq(coinTransactions.eventKey, `${eventKey}:coins`),
    )).limit(1)
    let coinAmount = 0
    if (coinReward) {
      coinAmount = coinReward.amount
      await tx.insert(coinTransactions).values({
        id: uuid(),
        userId: user.id,
        amount: -coinReward.amount,
        type: habitRow.isTask ? 'TASK_UNDO' : 'HABIT_UNDO',
        description: `Undid completion: ${habitRow.name}`,
        timestamp: new Date().toISOString(),
        relatedItemId: habitRow.id,
        eventKey: `${undoKey}:coins`,
      }).onConflictDoNothing()
    }
    const [xpReward] = await tx.select().from(xpTransactions).where(and(
      eq(xpTransactions.userId, user.id),
      eq(xpTransactions.eventKey, `${eventKey}:xp`),
    )).limit(1)
    let xpAmount = 0
    if (xpReward) {
      xpAmount = xpReward.amount
      const insertedUndo = await tx.insert(xpTransactions).values({
        id: uuid(),
        userId: user.id,
        amount: -xpReward.amount,
        source: habitRow.isTask ? 'TASK_UNDO' : 'HABIT_UNDO',
        relatedItemId: habitRow.id,
        timestamp: new Date().toISOString(),
        eventKey: `${undoKey}:xp`,
      }).onConflictDoNothing().returning({ id: xpTransactions.id })
      if (insertedUndo.length > 0) {
        await tx.update(xpState).set({ totalXP: sql`${xpState.totalXP} - ${xpReward.amount}` })
          .where(eq(xpState.userId, user.id))
      }
    }
    const attributeRewards = await tx.select().from(attributeTransactions).where(and(
      eq(attributeTransactions.userId, user.id),
      eq(attributeTransactions.eventKey, eventKey),
      eq(attributeTransactions.source, 'completion'),
    ))
    for (const reward of attributeRewards) {
      await tx.insert(attributeTransactions).values({
        id: uuid(),
        userId: user.id,
        attribute: reward.attribute,
        amount: -reward.amount,
        source: 'undo',
        eventKey: undoKey,
        relatedHabitId: habitRow.id,
        completionAt: parsed.completionAt,
      }).onConflictDoNothing()
    }
    if (habitRow.isTask) {
      await tx.update(habits).set({ archived: false }).where(and(eq(habits.id, habitRow.id), eq(habits.userId, user.id)))
    }
    return { inserted: true, targetReached: true, coinAmount, xpAmount }
  })

  return loadResult(outcome.inserted, outcome.targetReached, outcome.coinAmount, outcome.xpAmount)
}
