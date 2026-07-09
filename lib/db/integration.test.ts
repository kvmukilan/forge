import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import type { User } from '@/lib/types'

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

beforeAll(async () => {
  data = await import('@/app/actions/data')
  gamification = await import('@/app/actions/gamification')

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

  test('XP state is per user', async () => {
    actAs(userA)
    await gamification.addXP({ amount: 100, source: 'HABIT_COMPLETION' })

    actAs(userB)
    const bobXP = await gamification.loadXPData()
    expect(bobXP.totalXP).toBe(0)

    actAs(userA)
    const aliceXP = await gamification.loadXPData()
    expect(aliceXP.totalXP).toBe(100)
    expect(aliceXP.transactions).toHaveLength(1)
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
  })
})
