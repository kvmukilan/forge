'use client'

import { useAtom } from 'jotai'
import { weeklyDNAAtom } from '@/lib/gamification-atoms'
import { Dna } from 'lucide-react'

export default function HabitDNA() {
  const [dna] = useAtom(weeklyDNAAtom)

  if (dna.perHabit.length === 0) return null

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Dna className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold">Your Habit DNA This Week</span>
      </div>

      <div className="space-y-2 mb-4">
        {dna.perHabit.slice(0, 5).map(h => (
          <div key={h.name} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 truncate">{h.name}</span>
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${h.pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold w-8 text-right">{h.pct}%</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="glass-card p-2">
          <p className="text-xs text-muted-foreground">Weekdays</p>
          <p className="text-sm font-bold">{dna.weekdayPct}%</p>
        </div>
        <div className="glass-card p-2">
          <p className="text-xs text-muted-foreground">Weekends</p>
          <p className="text-sm font-bold">{dna.weekendPct}%</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">{dna.insight}</p>
    </div>
  )
}
