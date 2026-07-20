'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { getDb } from '@/lib/db'
import { dailyPlans, habits } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/server-helpers'
import { uuid } from '@/lib/utils'
import { PLAN_CAPACITY, type DailyMood, type EnergyLevel } from '@/lib/daily-plan'

export interface DailyPlan {
  planDate: string
  energy: EnergyLevel
  intention: string
  habitIds: string[]
  reflection: string
  mood: DailyMood | null
}

export type SaveDailyPlanInput = DailyPlan

const ENERGY_LEVELS = new Set<EnergyLevel>(['low', 'steady', 'high'])
const DAILY_MOODS = new Set<DailyMood>(['drained', 'okay', 'good', 'strong'])

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid
}

function toWire(row: typeof dailyPlans.$inferSelect): DailyPlan {
  return {
    planDate: row.planDate,
    energy: row.energy as EnergyLevel,
    intention: row.intention,
    habitIds: Array.isArray(row.habitIds) ? row.habitIds : [],
    reflection: row.reflection,
    mood: row.mood as DailyMood | null,
  }
}

export async function getDailyPlan(planDate: string): Promise<DailyPlan | null> {
  const user = await getCurrentUser()
  if (!user || !validDate(planDate)) return null

  const db = await getDb()
  const [row] = await db.select().from(dailyPlans)
    .where(and(eq(dailyPlans.userId, user.id), eq(dailyPlans.planDate, planDate)))
    .limit(1)
  return row ? toWire(row) : null
}

export async function saveDailyPlan(input: SaveDailyPlanInput): Promise<DailyPlan> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  if (!validDate(input.planDate)) throw new Error('Invalid plan date')
  if (!ENERGY_LEVELS.has(input.energy)) throw new Error('Invalid energy level')
  if (typeof input.intention !== 'string' || typeof input.reflection !== 'string') throw new Error('Invalid plan text')
  if (!Array.isArray(input.habitIds) || input.habitIds.some(id => typeof id !== 'string')) throw new Error('Invalid plan items')
  const mood = input.mood ?? null
  if (mood && !DAILY_MOODS.has(mood)) throw new Error('Invalid reflection mood')

  const intention = input.intention.trim().slice(0, 160)
  const reflection = input.reflection.trim().slice(0, 500)
  const habitIds = [...new Set(input.habitIds)].slice(0, PLAN_CAPACITY[input.energy])
  const db = await getDb()

  if (habitIds.length > 0) {
    const owned = await db.select({ id: habits.id }).from(habits)
      .where(and(eq(habits.userId, user.id), inArray(habits.id, habitIds)))
    if (owned.length !== habitIds.length) throw new Error('Plan contains an unavailable item')
  }

  const values = {
    id: uuid(),
    userId: user.id,
    planDate: input.planDate,
    energy: input.energy,
    intention,
    habitIds,
    reflection,
    mood,
    updatedAt: new Date(),
  }

  const [row] = await db.insert(dailyPlans).values(values).onConflictDoUpdate({
    target: [dailyPlans.userId, dailyPlans.planDate],
    set: {
      energy: values.energy,
      intention: values.intention,
      habitIds: values.habitIds,
      reflection: values.reflection,
      mood: values.mood,
      updatedAt: values.updatedAt,
    },
  }).returning()

  return toWire(row)
}
