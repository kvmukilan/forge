import { NextResponse } from 'next/server'
import { DateTime } from 'luxon'
import webpush from 'web-push'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { pushSubscriptions, pushLog, userSettings, habits, completions, xpState } from '@/lib/db/schema'
import { calculateStreak } from '@/lib/gamification'
import type { Habit, Settings } from '@/lib/types'

export const dynamic = 'force-dynamic'

const REMINDER_COPY = [
  'Time to forge. Your habits are waiting.',
  'Small reps, big person. Log one now.',
  'The streak doesn’t build itself — 2 minutes is enough.',
  'Your future self called. They want today logged.',
  'One habit now beats three tomorrow.',
  'The forge is hot. Strike.',
  'Show up today. That’s the whole job.',
]

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV === 'development'
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function copyFor(userId: string, date: string): string {
  let hash = 0
  const seed = `${userId}-${date}`
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  return REMINDER_COPY[Math.abs(hash) % REMINDER_COPY.length]
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return NextResponse.json({ ok: true, skipped: 'VAPID keys not configured' })
  }
  webpush.setVapidDetails('mailto:kvmukilan@gmail.com', publicKey, privateKey)

  try {
    const db = await getDb()
    const subs = await db.select().from(pushSubscriptions)
    if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    const userIds = [...new Set(subs.map(s => s.userId))]
    const settingsRows = await db.select().from(userSettings).where(inArray(userSettings.userId, userIds))
    const habitRows = await db.select().from(habits)
      .where(and(inArray(habits.userId, userIds), eq(habits.isTask, false), eq(habits.archived, false)))
    const habitIds = habitRows.map(h => h.id)
    const completionRows = habitIds.length > 0
      ? await db.select().from(completions).where(inArray(completions.habitId, habitIds))
      : []
    const xpRows = await db.select().from(xpState).where(inArray(xpState.userId, userIds))

    let sent = 0
    for (const userId of userIds) {
      const settings = settingsRows.find(s => s.userId === userId)?.data as Settings | undefined
      const timezone = settings?.system?.timezone ?? 'UTC'
      const reminderTime = settings?.ui?.notificationTime ?? '08:00'
      const local = DateTime.now().setZone(timezone)
      const today = local.toISODate()!

      const userHabits: Habit[] = habitRows
        .filter(h => h.userId === userId)
        .map(h => ({
          id: h.id,
          name: h.name,
          description: h.description,
          frequency: h.frequency,
          coinReward: h.coinReward,
          targetCompletions: h.targetCompletions ?? undefined,
          completions: completionRows.filter(c => c.habitId === h.id).map(c => c.completedAt),
        }))
      if (userHabits.length === 0) continue

      const completedTodayCount = userHabits.filter(h => {
        const target = h.targetCompletions ?? 1
        return h.completions.filter(c => DateTime.fromISO(c).setZone(timezone).toISODate() === today).length >= target
      }).length
      const allDoneToday = completedTodayCount >= userHabits.length

      const shieldDates = (xpRows.find(x => x.userId === userId)?.shieldUsedDates as string[]) ?? []

      const notifications: Array<{ kind: string; title: string; body: string }> = []

      // Reminder: once the user's chosen hour has passed and nothing is logged yet
      const [remH, remM] = reminderTime.split(':').map(Number)
      const reminderPassed = local.hour > remH || (local.hour === remH && local.minute >= remM)
      if (reminderPassed && completedTodayCount === 0) {
        notifications.push({ kind: 'reminder', title: 'Forge', body: copyFor(userId, today) })
      }

      // Streak risk: evening, streak ≥ 3, day not fully logged
      if (local.hour >= 18 && !allDoneToday) {
        const atRisk = userHabits
          .map(h => ({ h, streak: calculateStreak(h, timezone, shieldDates) }))
          .filter(({ h, streak }) => {
            if (streak < 3) return false
            const target = h.targetCompletions ?? 1
            const doneToday = h.completions.filter(c => DateTime.fromISO(c).setZone(timezone).toISODate() === today).length
            return doneToday < target
          })
          .sort((a, b) => b.streak - a.streak)
        if (atRisk.length > 0) {
          const top = atRisk[0]
          notifications.push({
            kind: 'streak_risk',
            title: `${top.streak}-day streak at risk 🔥`,
            body: `"${top.h.name}" isn’t logged yet. ${24 - local.hour}h left to keep it alive.`,
          })
        }
      }

      for (const notification of notifications) {
        // Max one per kind per local day
        const logged = await db.insert(pushLog).values({
          userId,
          kind: notification.kind,
          sentOn: today,
        }).onConflictDoNothing().returning()
        if (logged.length === 0) continue

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: '/icons/web-app-manifest-192x192.png',
        })
        for (const sub of subs.filter(s => s.userId === userId)) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
            sent++
          } catch (error: unknown) {
            const statusCode = (error as { statusCode?: number }).statusCode
            if (statusCode === 404 || statusCode === 410) {
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint))
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error('Push cron failed:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
