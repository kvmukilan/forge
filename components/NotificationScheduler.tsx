'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { settingsAtom } from '@/lib/atoms'
import { subscribeUser, unsubscribeUser } from '@/app/actions/push'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

// Manages the Web Push subscription lifecycle. Actual notification delivery is
// server-side (/api/cron/push) so reminders arrive even with the app closed.
export default function NotificationScheduler() {
  const settings = useAtomValue(settingsAtom)
  const enabled = settings.ui.notificationsEnabled ?? false

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    let cancelled = false

    const sync = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        if (cancelled) return

        if (!enabled) {
          const existing = await registration.pushManager.getSubscription()
          if (existing) {
            await existing.unsubscribe()
            await unsubscribeUser(existing.endpoint)
          }
          return
        }

        if (Notification.permission === 'default') {
          await Notification.requestPermission()
        }
        if (Notification.permission !== 'granted' || cancelled) return

        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
          }))

        const json = subscription.toJSON()
        if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
          await subscribeUser({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          })
        }
      } catch (error) {
        console.error('Push subscription sync failed:', error)
      }
    }

    sync()
    return () => { cancelled = true }
  }, [enabled])

  return null
}
