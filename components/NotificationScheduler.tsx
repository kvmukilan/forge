'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { settingsAtom } from '@/lib/atoms'

export default function NotificationScheduler() {
  const settings = useAtomValue(settingsAtom)
  const enabled = settings.ui.notificationsEnabled ?? false
  const timeStr = settings.ui.notificationTime ?? '08:00'

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    if (!('Notification' in window)) return

    let timeoutId: ReturnType<typeof setTimeout>

    const scheduleNext = () => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      const now = new Date()
      const next = new Date()
      next.setHours(hours, minutes, 0, 0)
      if (next <= now) next.setDate(next.getDate() + 1)
      const ms = next.getTime() - now.getTime()

      timeoutId = setTimeout(async () => {
        if (Notification.permission === 'granted') {
          new Notification('Forge', {
            body: "Time to build your habits! Open Forge to log today's progress.",
            icon: '/icons/icon.png',
          })
        }
        scheduleNext()
      }, ms)
    }

    const requestAndSchedule = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
      if (Notification.permission === 'granted') {
        scheduleNext()
      }
    }

    requestAndSchedule()
    return () => clearTimeout(timeoutId)
  }, [enabled, timeStr])

  return null
}
