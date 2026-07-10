import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { User } from '@/lib/types'

mock.module('server-only', () => ({}))

let currentUser: User | undefined

mock.module('@/lib/server-helpers', () => ({
  getCurrentUser: async () => currentUser,
  getCurrentUserId: async () => currentUser?.id,
  saltAndHashPassword: (pw: string) => `salt:${pw}`,
  verifyPassword: (pw?: string, hash?: string) => !!pw && hash === `salt:${pw}`,
}))

const userA: User = { id: 'ret-user-a', username: 'ret_alice', isAdmin: false }
const userB: User = { id: 'ret-user-b', username: 'ret_bob', isAdmin: false }

let retention: typeof import('@/app/actions/retention')
let data: typeof import('@/app/actions/data')

beforeAll(async () => {
  retention = await import('@/app/actions/retention')
  data = await import('@/app/actions/data')

  const { getDb } = await import('@/lib/db')
  const { users } = await import('@/lib/db/schema')
  const db = await getDb()
  await db.insert(users).values([
    { id: userA.id, username: userA.username },
    { id: userB.id, username: userB.username },
  ]).onConflictDoNothing()
})

afterAll(async () => {
  const { closeDb } = await import('@/lib/db')
  await closeDb()
})

describe('daily login calendar', () => {
  test('first claim is day 1 and grants coins', async () => {
    currentUser = userA
    const result = await retention.claimDailyLogin()
    expect(result?.claimed).toBe(true)
    expect(result?.streakIndex).toBe(1)
    expect(result?.reward.coins).toBe(10)
    const coins = await data.loadCoinsData()
    expect(coins.balance).toBe(10)
  })

  test('second claim on the same day is a no-op', async () => {
    currentUser = userA
    const result = await retention.claimDailyLogin()
    expect(result?.claimed).toBe(false)
    const coins = await data.loadCoinsData()
    expect(coins.balance).toBe(10)
  })

  test('calendar state reflects the claim per user', async () => {
    currentUser = userA
    const stateA = await retention.getLoginCalendarState()
    expect(stateA?.todayClaimed).toBe(true)

    currentUser = userB
    const stateB = await retention.getLoginCalendarState()
    expect(stateB?.todayClaimed).toBe(false)
    expect(stateB?.streakIndex).toBe(1)
  })
})

describe('daily quests', () => {
  test('three deterministic quests are generated per user per day', async () => {
    currentUser = userA
    const first = await retention.getDailyQuests()
    const second = await retention.getDailyQuests()
    expect(first).toHaveLength(3)
    expect(first.map(q => q.key)).toEqual(second.map(q => q.key))
    // No pet and no keystone habit -> those quests must not appear
    expect(first.some(q => q.key === 'feed_pet')).toBe(false)
    expect(first.some(q => q.key === 'complete_keystone')).toBe(false)
  })

  test('claiming an incomplete quest fails', async () => {
    currentUser = userA
    const quests = await retention.getDailyQuests()
    const incomplete = quests.find(q => !q.isComplete)
    if (!incomplete) return // all complete — nothing to assert
    const result = await retention.claimDailyQuest(incomplete.key)
    expect(result.success).toBe(false)
  })

  test('completing habits drives quest progress and claiming pays out', async () => {
    currentUser = userA
    // Create 3 habits, each completed now
    const nowISO = new Date().toISOString()
    await data.saveHabitsData({
      habits: [1, 2, 3].map(n => ({
        id: `ret-habit-${n}`,
        name: `Quest habit ${n}`,
        description: '',
        frequency: 'every day',
        coinReward: 1,
        completions: [nowISO],
      })),
    })

    const quests = await retention.getDailyQuests()
    const completable = quests.find(q => (q.key === 'complete_1' || q.key === 'complete_3') && q.isComplete)
    if (!completable) return

    const before = (await data.loadCoinsData()).balance
    const result = await retention.claimDailyQuest(completable.key)
    expect(result.success).toBe(true)
    const after = (await data.loadCoinsData()).balance
    expect(after).toBe(before + completable.reward.coins)

    const dup = await retention.claimDailyQuest(completable.key)
    expect(dup.success).toBe(false)
  })
})

describe('mystery chest', () => {
  test('chest is not available without entitlement', async () => {
    currentUser = userB
    const result = await retention.openChest('login_day7')
    expect(result.success).toBe(false)
  })
})

describe('league', () => {
  test('user with completions gets lazily assigned to a bronze cohort', async () => {
    currentUser = userA // has completions from the quest test
    const league = await retention.getMyLeague()
    expect(league).not.toBeNull()
    expect(league!.tier).toBe(1)
    expect(league!.tierName).toBe('Bronze')
    expect(league!.standings.some(s => s.isMe)).toBe(true)
    expect(league!.standings.find(s => s.isMe)!.score).toBeGreaterThan(0)
  })

  test('user with no completions has no league', async () => {
    currentUser = userB
    const league = await retention.getMyLeague()
    expect(league).toBeNull()
  })

  test('closing the week stamps results idempotently', async () => {
    currentUser = userA
    const league = await retention.getMyLeague()
    const closed = await retention.closeLeagueWeek(league!.weekStart)
    expect(closed).toBeGreaterThanOrEqual(1)
    const again = await retention.closeLeagueWeek(league!.weekStart)
    expect(again).toBe(0)
  })
})
