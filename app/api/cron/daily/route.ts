import { NextResponse } from 'next/server'
import { DateTime } from 'luxon'
import { v4 as uuid } from 'uuid'
import { and, eq, gt, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { habits, completions, coinTransactions, xpState, userSettings } from '@/lib/db/schema'
import type { Settings } from '@/lib/types'

export const dynamic = 'force-dynamic'

const OVERDUE_PENALTY = 5

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV === 'development'
  return request.headers.get('authorization') === `Bearer ${secret}`
}

// Applies a one-time coin penalty for tasks that passed their due date uncompleted.
// Runs once a day via Vercel Cron (see vercel.json).
async function applyOverduePenalties(): Promise<number> {
  const db = await getDb()
  const today = DateTime.utc().startOf('day')

  const taskRows = await db.select().from(habits)
    .where(and(eq(habits.isTask, true), eq(habits.archived, false)))
  if (taskRows.length === 0) return 0

  const taskIds = taskRows.map(t => t.id)
  const completionRows = await db.select().from(completions).where(inArray(completions.habitId, taskIds))

  // Tasks already penalized (penalty is once per task, not nightly)
  const penalized = await db.select({ relatedItemId: coinTransactions.relatedItemId }).from(coinTransactions)
    .where(and(eq(coinTransactions.type, 'TASK_OVERDUE_PENALTY'), inArray(coinTransactions.relatedItemId, taskIds)))
  const penalizedIds = new Set(penalized.map(p => p.relatedItemId))

  const overdue = taskRows.filter(task => {
    if (penalizedIds.has(task.id)) return false
    const dueDate = DateTime.fromISO(task.frequency).startOf('day')
    if (!dueDate.isValid || dueDate >= today) return false
    const target = task.targetCompletions ?? 1
    const completedOnDueDate = completionRows.filter(c =>
      c.habitId === task.id &&
      DateTime.fromISO(c.completedAt).startOf('day').toISODate() === dueDate.toISODate()
    ).length
    return completedOnDueDate < target
  })

  if (overdue.length > 0) {
    await db.insert(coinTransactions).values(overdue.map(task => ({
      id: uuid(),
      userId: task.userId,
      amount: -OVERDUE_PENALTY,
      type: 'TASK_OVERDUE_PENALTY',
      description: `Overdue penalty: ${task.name}`,
      timestamp: new Date().toISOString(),
      relatedItemId: task.id,
    })))
  }
  return overdue.length
}

// Spends one streak shield per user whose streak would otherwise have broken
// yesterday (a shield covers the whole day, all habits).
async function autoConsumeShields(): Promise<number> {
  const db = await getDb()

  const shieldHolders = await db.select().from(xpState).where(gt(xpState.shields, 0))
  if (shieldHolders.length === 0) return 0

  const holderIds = shieldHolders.map(s => s.userId)
  const settingsRows = await db.select().from(userSettings).where(inArray(userSettings.userId, holderIds))
  const habitRows = await db.select().from(habits)
    .where(and(inArray(habits.userId, holderIds), eq(habits.isTask, false), eq(habits.archived, false)))
  const habitIds = habitRows.map(h => h.id)
  const completionRows = habitIds.length > 0
    ? await db.select().from(completions).where(inArray(completions.habitId, habitIds))
    : []

  let consumed = 0
  for (const state of shieldHolders) {
    const settings = settingsRows.find(s => s.userId === state.userId)?.data as Settings | undefined
    const timezone = settings?.system?.timezone ?? 'UTC'
    const yesterday = DateTime.now().setZone(timezone).minus({ days: 1 }).toISODate()!
    const dayBefore = DateTime.now().setZone(timezone).minus({ days: 2 }).toISODate()!

    const usedDates = (state.shieldUsedDates as string[]) ?? []
    if (usedDates.includes(yesterday)) continue

    const userHabits = habitRows.filter(h => h.userId === state.userId)
    const completedOn = (habitId: string, isoDate: string, target: number) =>
      completionRows.filter(c =>
        c.habitId === habitId &&
        DateTime.fromISO(c.completedAt).setZone(timezone).toISODate() === isoDate
      ).length >= target

    const streakAtRisk = userHabits.some(h => {
      const target = h.targetCompletions ?? 1
      return completedOn(h.id, dayBefore, target) && !completedOn(h.id, yesterday, target)
    })
    if (!streakAtRisk) continue

    await db.update(xpState).set({
      shields: state.shields - 1,
      shieldUsedDates: [...usedDates, yesterday],
    }).where(eq(xpState.userId, state.userId))
    consumed++
  }
  return consumed
}

// Close any league week that has ended but hasn't been finalized (idempotent,
// so running daily is fine — it only does work on/after Mondays)
async function closeFinishedLeagueWeeks(): Promise<number> {
  const { closeLeagueWeek } = await import('@/app/actions/retention')
  const now = DateTime.utc()
  const thisMonday = now.minus({ days: now.weekday - 1 }).toISODate()!
  const lastMonday = now.minus({ days: now.weekday - 1 + 7 }).toISODate()!
  // Finalize last week (and re-run is a no-op thanks to the already-closed guard)
  return closeLeagueWeek(lastMonday === thisMonday ? thisMonday : lastMonday)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const penalties = await applyOverduePenalties()
    const shieldsConsumed = await autoConsumeShields()
    const leaguesClosed = await closeFinishedLeagueWeeks()
    return NextResponse.json({ ok: true, penalties, shieldsConsumed, leaguesClosed })
  } catch (error) {
    console.error('Daily cron failed:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
