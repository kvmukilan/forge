'use server'

import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { getCurrentUser } from '@/lib/server-helpers'

function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails('mailto:kvmukilan@gmail.com', publicKey, privateKey)
  return true
}

interface PushSubscriptionWithKeys {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export async function subscribeUser(sub: PushSubscriptionWithKeys) {
  const user = await getCurrentUser()
  if (!user) return { success: false }
  const db = await getDb()
  await db.insert(pushSubscriptions).values({
    endpoint: sub.endpoint,
    userId: user.id,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  }).onConflictDoUpdate({
    target: pushSubscriptions.endpoint,
    set: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  })
  return { success: true }
}

export async function unsubscribeUser(endpoint?: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false }
  const db = await getDb()
  if (endpoint) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  } else {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id))
  }
  return { success: true }
}

// Sends a push to every subscription of the current user (e.g. the settings-page test button)
export async function sendNotification(message: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!configureWebPush()) return { success: false, error: 'Push is not configured (VAPID keys missing)' }
  const db = await getDb()
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id))
  if (subs.length === 0) return { success: false, error: 'No subscription available' }

  const payload = JSON.stringify({
    title: 'Forge',
    body: message,
    icon: '/icons/web-app-manifest-192x192.png',
  })

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (error: unknown) {
      // 404/410 mean the subscription is dead — clean it up
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint))
      } else {
        console.error('Error sending push notification:', error)
      }
    }
  }
  return sent > 0 ? { success: true } : { success: false, error: 'Failed to send notification' }
}
