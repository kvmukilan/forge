'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAtomValue } from 'jotai'
import { DateTime } from 'luxon'
import { habitsAtom, settingsAtom } from '@/lib/atoms'
import { habitStreaksAtom, shieldsAtom } from '@/lib/gamification-atoms'
import { Flame } from 'lucide-react'

const RISK_HOUR = 18 // start warning in the evening
const MIN_STREAK = 3

export default function StreakAtRiskBanner() {
  const habits = useAtomValue(habitsAtom).habits
  const streaks = useAtomValue(habitStreaksAtom)
  const shields = useAtomValue(shieldsAtom)
  const settings = useAtomValue(settingsAtom)
  const [now, setNow] = useState<DateTime | null>(null)

  // Clock lives in state so the banner appears without a reload once evening hits
  useEffect(() => {
    setNow(DateTime.now())
    const id = setInterval(() => setNow(DateTime.now()), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return null
  const timezone = settings.system.timezone
  const local = now.setZone(timezone)
  if (local.hour < RISK_HOUR) return null

  const todayStr = local.toISODate()!
  const atRisk = habits
    .filter(h => !h.isTask && !h.archived)
    .filter(h => (streaks.get(h.id) ?? 0) >= MIN_STREAK)
    .filter(h => {
      const target = h.targetCompletions ?? 1
      const doneToday = h.completions.filter(c =>
        DateTime.fromISO(c).setZone(timezone).toISODate() === todayStr
      ).length
      return doneToday < target
    })
    .sort((a, b) => (streaks.get(b.id) ?? 0) - (streaks.get(a.id) ?? 0))

  if (atRisk.length === 0) return null

  const top = atRisk[0]
  const topStreak = streaks.get(top.id) ?? 0
  const hoursLeft = 24 - local.hour

  return (
    <Link
      href="/habits"
      className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 hover:bg-primary/15 transition-colors"
    >
      <Flame className="h-5 w-5 text-primary flex-shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">
          {atRisk.length === 1
            ? `Your ${topStreak}-day streak on "${top.name}" is at risk`
            : `${atRisk.length} streaks at risk — longest is ${topStreak} days`}
        </p>
        <p className="text-xs text-muted-foreground">
          About {hoursLeft}h left today{shields > 0 ? ` · ${shields} shield${shields > 1 ? 's' : ''} standing by` : ''}
        </p>
      </div>
      <span className="text-xs font-bold text-primary uppercase tracking-wide flex-shrink-0">Log now</span>
    </Link>
  )
}
