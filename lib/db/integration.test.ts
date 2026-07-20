import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { User } from '@/lib/types'
import { generateStarterProgram, type AssessmentResponses } from '@/lib/progression'
import { DateTime } from 'luxon'

// Neutralize the server-only guard and NextAuth for tests
mock.module('server-only', () => ({}))

let currentUser: User | undefined

mock.module('@/lib/server-helpers', () => ({
  getCurrentUser: async () => currentUser,
  getCurrentUserId: async () => currentUser?.id,
  saltAndHashPassword: (pw: string) => `salt:${pw}`,
  verifyPassword: (pw?: string, hash?: string) => !!pw && hash === `salt:${pw}`,
}))

const userA: User = { id: 'user-a', username: 'alice', isAdmin: false }
const userB: User = { id: 'user-b', username: 'bob', isAdmin: false }

let data: typeof import('@/app/actions/data')
let gamification: typeof import('@/app/actions/gamification')
let dailyPlanning: typeof import('@/app/actions/daily-plan')
let progression: typeof import('@/app/actions/progression')
let completionAction: typeof import('@/app/actions/completion')

beforeAll(async () => {
  data = await import('@/app/actions/data')
  gamification = await import('@/app/actions/gamification')
  dailyPlanning = await import('@/app/actions/daily-plan')
  progression = await import('@/app/actions/progression')
  completionAction = await import('@/app/actions/completion')

  const { getDb } = await import('@/lib/db')
  const { users } = await import('@/lib/db/schema')
  const db = await getDb()
  await db.insert(users).values([
    { id: userA.id, username: userA.username },
    { id: userB.id, username: userB.username },
  ])
})

afterAll(async () => {
  const { closeDb } = await import('@/lib/db')
  await closeDb()
})

function actAs(user: User | undefined) {
  currentUser = user
}

describe('per-user data isolation (PGlite in-memory)', () => {
  test('habits are scoped to their owner', async () => {
    actAs(userA)
    await data.saveHabitsData({
      habits: [{
        id: 'habit-a1',
        name: 'Alice habit',
        description: '',
        frequency: 'FREQ=DAILY',
        coinReward: 5,
        completions: ['2026-07-01T10:00:00.000Z'],
      }],
    })

    actAs(userB)
    const bobView = await data.loadHabitsData()
    expect(bobView.habits).toHaveLength(0)

    actAs(userA)
    const aliceView = await data.loadHabitsData()
    expect(aliceView.habits).toHaveLength(1)
    expect(aliceView.habits[0].completions).toEqual(['2026-07-01T10:00:00.000Z'])
    expect(aliceView.habits[0].userIds).toEqual([userA.id])
  })

  test('completions round-trip through save (add + undo)', async () => {
    actAs(userA)
    const loaded = await data.loadHabitsData()
    const habit = loaded.habits[0]

    // add a completion
    await data.saveHabitsData({ habits: [{ ...habit, completions: [...habit.completions, '2026-07-02T09:00:00.000Z'] }] })
    let view = await data.loadHabitsData()
    expect(view.habits[0].completions).toHaveLength(2)

    // undo it
    await data.saveHabitsData({ habits: [{ ...habit, completions: habit.completions }] })
    view = await data.loadHabitsData()
    expect(view.habits[0].completions).toEqual(['2026-07-01T10:00:00.000Z'])
  })

  test('daily plans sync per user and reject another user\'s habits', async () => {
    actAs(userA)
    const saved = await dailyPlanning.saveDailyPlan({
      planDate: '2026-07-16',
      energy: 'low',
      intention: 'Keep the promise small',
      habitIds: ['habit-a1'],
      reflection: '',
      mood: null,
    })
    expect(saved.habitIds).toEqual(['habit-a1'])

    actAs(userB)
    expect(await dailyPlanning.getDailyPlan('2026-07-16')).toBeNull()
    await expect(dailyPlanning.saveDailyPlan({
      planDate: '2026-07-16',
      energy: 'steady',
      intention: '',
      habitIds: ['habit-a1'],
      reflection: '',
      mood: null,
    })).rejects.toThrow('unavailable item')

    actAs(userA)
    const loaded = await dailyPlanning.getDailyPlan('2026-07-16')
    expect(loaded?.intention).toBe('Keep the promise small')
  })

  test('assessment programs and attribute rewards are user-scoped and idempotent', async () => {
    const responses: AssessmentResponses = {
      focusAreas: ['strength', 'focus'],
      baselines: { strength: 2, vitality: 3, focus: 2, wisdom: 3, discipline: 3, connection: 3 },
      consistency: 3,
      energy: 3,
      weekdayMinutes: 30,
      weekendMinutes: 45,
      preferredTime: 'morning',
      pace: 'balanced',
      motivation: 'visible_progress',
      restDays: [0],
      constraints: '',
    }
    const recommendations = generateStarterProgram(responses)

    actAs(userA)
    const activated = await progression.finalizeOnboarding({
      responses,
      attributes: { strength: 4, vitality: 5, focus: 4, wisdom: 5, discipline: 4, connection: 5 },
      recommendations,
    })
    expect(activated.profile.onboardingCompleted).toBe(true)
    expect(activated.campaign.day).toBeGreaterThanOrEqual(1)
    expect((await data.loadHabitsData()).habits.find(habit => habit.id === 'habit-a1')?.completions)
      .toEqual(['2026-07-01T10:00:00.000Z'])

    const before = await progression.getProgressionSummary()
    await progression.awardAttributeProgress({ habitId: 'habit-a1', completionAt: '2026-07-01T10:00:00.000Z' })
    await progression.awardAttributeProgress({ habitId: 'habit-a1', completionAt: '2026-07-01T10:00:00.000Z' })
    const awarded = await progression.getProgressionSummary()
    expect(awarded!.attributes.discipline.earnedXP - before!.attributes.discipline.earnedXP).toBe(10)

    await progression.saveQuestFeedback({ habitId: 'habit-a1', completionAt: '2026-07-01T10:00:00.000Z', rating: 'right' })
    await progression.revokeAttributeProgress({ habitId: 'habit-a1', completionAt: '2026-07-01T10:00:00.000Z' })
    await progression.revokeAttributeProgress({ habitId: 'habit-a1', completionAt: '2026-07-01T10:00:00.000Z' })
    const revoked = await progression.getProgressionSummary()
    expect(revoked!.attributes.discipline.earnedXP).toBe(before!.attributes.discipline.earnedXP)

    actAs(userB)
    expect(await progression.getProgressionSummary()).toBeNull()
    await expect(progression.saveQuestFeedback({
      habitId: 'habit-a1', completionAt: '2026-07-01T10:00:00.000Z', rating: 'too_easy',
    })).rejects.toThrow('Completion not found')
  })

  test('assessment retakes preserve the campaign and user quest edits can be deleted permanently', async () => {
    actAs(userA)
    const before = await progression.getProgressionSummary()
    const loaded = await data.loadHabitsData()
    const editedQuest = loaded.habits.find(habit => habit.progressionOrigin === 'assessment')!
    await data.saveHabitsData({
      habits: loaded.habits.map(habit => habit.id === editedQuest.id ? {
        ...habit,
        name: 'My edited starter quest',
        frequency: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        adaptiveEnabled: false,
        pausedUntil: '2026-08-01',
      } : habit),
    })

    const responses = before!.profile.responses as AssessmentResponses
    const retakeAttributes = { ...before!.profile.baseAttributes, focus: 8 }
    await progression.finalizeOnboarding({
      responses: { ...responses, consistency: 4 },
      attributes: retakeAttributes,
      recommendations: generateStarterProgram({ ...responses, consistency: 4 }),
    })
    const after = await progression.getProgressionSummary()
    const afterHabits = await data.loadHabitsData()
    const preservedEdit = afterHabits.habits.find(habit => habit.id === editedQuest.id)!
    expect(after!.profile.campaignStartedOn).toBe(before!.profile.campaignStartedOn)
    expect(after!.profile.baseAttributes.focus).toBe(8)
    expect(preservedEdit.name).toBe('My edited starter quest')
    expect(preservedEdit.adaptiveEnabled).toBe(false)
    expect(preservedEdit.pausedUntil).toBe('2026-08-01')

    await data.saveHabitsData({ habits: afterHabits.habits.filter(habit => habit.id !== editedQuest.id) })
    expect((await data.loadHabitsData()).habits.some(habit => habit.id === editedQuest.id)).toBe(false)
  })

  test('coins are scoped to their owner and balance sums per user', async () => {
    actAs(userA)
    await data.addCoins({ amount: 10, description: 'Alice earn', type: 'HABIT_COMPLETION' })

    actAs(userB)
    await data.addCoins({ amount: 3, description: 'Bob earn', type: 'HABIT_COMPLETION' })
    const bobCoins = await data.loadCoinsData()
    expect(bobCoins.balance).toBe(3)
    expect(bobCoins.transactions).toHaveLength(1)

    actAs(userA)
    const aliceCoins = await data.loadCoinsData()
    expect(aliceCoins.balance).toBe(10)
  })

  test('today completion and core rewards commit once and undo together', async () => {
    actAs(userA)
    const existing = await data.loadHabitsData()
    await data.saveHabitsData({
      habits: [...existing.habits, {
        id: 'atomic-habit',
        name: 'Atomic habit',
        description: '',
        frequency: 'FREQ=DAILY',
        coinReward: 8,
        targetCompletions: 1,
        completions: [],
        difficulty: 'hard',
        category: 'fitness',
        primaryAttribute: 'strength',
        attributeReward: 20,
      }],
    })
    const completionAt = DateTime.now().toUTC().toISO()!
    const coinsBefore = await data.loadCoinsData()
    const xpBefore = await gamification.loadXPData()
    const attributesBefore = await progression.getProgressionSummary()

    const first = await completionAction.completeHabitWithRewards({ habitId: 'atomic-habit', completionAt })
    const duplicate = await completionAction.completeHabitWithRewards({ habitId: 'atomic-habit', completionAt })
    expect(first.inserted).toBe(true)
    expect(first.targetReached).toBe(true)
    expect(duplicate.inserted).toBe(false)
    expect((await data.loadHabitsData()).habits.find(habit => habit.id === 'atomic-habit')!.completions).toEqual([completionAt])
    expect((await data.loadCoinsData()).balance).toBe(coinsBefore.balance + first.coinAmount)
    expect((await gamification.loadXPData()).totalXP).toBe(xpBefore.totalXP + first.xpAmount)
    expect((await progression.getProgressionSummary())!.attributes.strength.earnedXP)
      .toBe(attributesBefore!.attributes.strength.earnedXP + 20)

    const undone = await completionAction.undoHabitWithRewards({ habitId: 'atomic-habit', completionAt })
    const duplicateUndo = await completionAction.undoHabitWithRewards({ habitId: 'atomic-habit', completionAt })
    expect(undone.inserted).toBe(true)
    expect(duplicateUndo.inserted).toBe(false)
    expect((await data.loadCoinsData()).balance).toBe(coinsBefore.balance)
    expect((await gamification.loadXPData()).totalXP).toBe(xpBefore.totalXP)
    expect((await progression.getProgressionSummary())!.attributes.strength.earnedXP)
      .toBe(attributesBefore!.attributes.strength.earnedXP)
  })

  test('completion coin and XP rewards are idempotent and undo their exact ledger amounts', async () => {
    actAs(userA)
    const coinsBefore = await data.loadCoinsData()
    const xpBefore = await gamification.loadXPData()
    const rewardKey = 'completion:habit-a1:2026-07-20T10:00:00.000Z'

    await data.addCoins({ amount: 17, description: 'Boosted completion', type: 'HABIT_COMPLETION', eventKey: `${rewardKey}:coins` })
    await data.addCoins({ amount: 17, description: 'Boosted completion', type: 'HABIT_COMPLETION', eventKey: `${rewardKey}:coins` })
    await gamification.addXP({ amount: 23, source: 'HABIT_COMPLETION', eventKey: `${rewardKey}:xp` })
    await gamification.addXP({ amount: 23, source: 'HABIT_COMPLETION', eventKey: `${rewardKey}:xp` })

    expect((await data.loadCoinsData()).balance).toBe(coinsBefore.balance + 17)
    expect((await gamification.loadXPData()).totalXP).toBe(xpBefore.totalXP + 23)

    await data.reverseCoinReward({
      originalEventKey: `${rewardKey}:coins`,
      undoEventKey: `undo:${rewardKey}:coins`,
      description: 'Undo boosted completion',
      type: 'HABIT_UNDO',
    })
    await data.reverseCoinReward({
      originalEventKey: `${rewardKey}:coins`,
      undoEventKey: `undo:${rewardKey}:coins`,
      description: 'Undo boosted completion',
      type: 'HABIT_UNDO',
    })
    await gamification.reverseXPReward({
      originalEventKey: `${rewardKey}:xp`,
      undoEventKey: `undo:${rewardKey}:xp`,
      source: 'HABIT_UNDO',
    })
    await gamification.reverseXPReward({
      originalEventKey: `${rewardKey}:xp`,
      undoEventKey: `undo:${rewardKey}:xp`,
      source: 'HABIT_UNDO',
    })

    expect((await data.loadCoinsData()).balance).toBe(coinsBefore.balance)
    expect((await gamification.loadXPData()).totalXP).toBe(xpBefore.totalXP)
  })

  test('XP state is per user', async () => {
    actAs(userA)
    const before = await gamification.loadXPData()
    await gamification.addXP({ amount: 100, source: 'HABIT_COMPLETION' })

    actAs(userB)
    const bobXP = await gamification.loadXPData()
    expect(bobXP.totalXP).toBe(0)

    actAs(userA)
    const aliceXP = await gamification.loadXPData()
    expect(aliceXP.totalXP).toBe(before.totalXP + 100)
    expect(aliceXP.transactions).toHaveLength(before.transactions.length + 1)
  })

  test('adaptive progression uses the user timezone, applies one step, and starts a cooldown', async () => {
    actAs(userA)
    const settings = await data.loadSettings()
    await data.saveSettings({ ...settings, system: { ...settings.system, timezone: 'Asia/Kolkata' } })
    const loaded = await data.loadHabitsData()
    const selected = loaded.habits.find(habit => habit.progressionOrigin === 'assessment')
    expect(selected).toBeDefined()
    const today = DateTime.now().setZone('Asia/Kolkata').startOf('day')
    const completionTimes = Array.from({ length: 14 }, (_, index) =>
      today.minus({ days: index }).plus({ hours: 12 }).toUTC().toISO()!,
    )
    await data.saveHabitsData({
      habits: loaded.habits.map(habit => habit.id === selected!.id
        ? { ...habit, archived: false, completions: completionTimes }
        : { ...habit, archived: true }),
    })
    const { getDb } = await import('@/lib/db')
    const { habits: habitsTable } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')
    await (await getDb()).update(habitsTable)
      .set({ createdAt: today.minus({ days: 20 }).toJSDate() })
      .where(eq(habitsTable.id, selected!.id))
    for (const completionAt of completionTimes.slice(0, 3)) {
      await progression.saveQuestFeedback({ habitId: selected!.id, completionAt, rating: 'right' })
    }

    const [recommendation] = await progression.getAdaptationRecommendations()
    expect(recommendation.habitId).toBe(selected!.id)
    expect(recommendation.action).toBe('increase')
    expect(recommendation.nextLevel).toBe(1)
    await progression.acceptAdaptation({ habitId: recommendation.habitId, nextLevel: recommendation.nextLevel })

    const adapted = (await data.loadHabitsData()).habits.find(habit => habit.id === selected!.id)!
    expect(adapted.adaptationLevel).toBe(1)
    expect(adapted.difficulty).not.toBe(selected!.difficulty)
    expect(await progression.getAdaptationRecommendations()).toHaveLength(0)
  })

  test('bosses spawn per user', async () => {
    actAs(userA)
    const aliceBoss = await gamification.getOrSpawnBoss('2026-07-06', 5)
    expect(aliceBoss.boss).not.toBeNull()

    actAs(userB)
    const bobBossBefore = await gamification.loadBossData()
    expect(bobBossBefore.boss).toBeNull()

    await gamification.damageBoss(1)
    actAs(userA)
    const aliceBossAfter = await gamification.loadBossData()
    expect(aliceBossAfter.boss!.currentHP).toBe(aliceBoss.boss!.maxHP)
  })

  test('shields consume once per date', async () => {
    actAs(userA)
    const xp = await gamification.loadXPData()
    await gamification.saveXPData({ ...xp, shields: 2 })

    await gamification.consumeShield('2026-07-05')
    await gamification.consumeShield('2026-07-05') // same date: no double spend
    const after = await gamification.loadXPData()
    expect(after.shields).toBe(1)
    expect(after.shieldUsedDates).toEqual(['2026-07-05'])
  })

  test('registerUser enforces password policy and uniqueness', async () => {
    actAs(undefined)
    const tooShort = await data.registerUser('charlie', 'short')
    expect(tooShort.success).toBe(false)

    const ok = await data.registerUser('charlie', 'longenough123')
    expect(ok.success).toBe(true)

    const dup = await data.registerUser('charlie', 'longenough123')
    expect(dup.success).toBe(false)
  })

  test('unauthenticated loads return empty defaults', async () => {
    actAs(undefined)
    const habits = await data.loadHabitsData()
    expect(habits.habits).toHaveLength(0)
    const coins = await data.loadCoinsData()
    expect(coins.balance).toBe(0)
    const publicUsers = await data.loadUsersPublicData()
    expect(publicUsers.users).toHaveLength(0)
  })
})
