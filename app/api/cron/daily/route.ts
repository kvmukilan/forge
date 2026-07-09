import { NextResponse } from 'next/server'
import { DateTime } from 'luxon'
import { v4 as uuid } from 'uuid'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { habits, completions, coinTransactions } from '@/lib/db/schema'

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

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const penalties = await applyOverduePenalties()
    return NextResponse.json({ ok: true, penalties })
  } catch (error) {
    console.error('Daily cron failed:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
