'use client'

import { useAtom, useAtomValue } from 'jotai'
import { habitsAtom, coinsAtom, settingsAtom } from '@/lib/atoms'
import { xpAtom, maxStreakAtom } from '@/lib/gamification-atoms'
import {
  getYearlyCompletionMap,
  getDayOfWeekStats,
  getPerHabitStats,
  getCoinBreakdown,
  getHabitCorrelations,
} from '@/lib/analytics'
import { useMemo } from 'react'
import { BarChart3, Calendar, TrendingUp, Zap } from 'lucide-react'
import { DateTime } from 'luxon'
import { cn } from '@/lib/utils'

function YearlyHeatmap({ completionMap, timezone }: { completionMap: Map<string, number>; timezone: string }) {
  // Build 52 weeks x 7 days grid for the past year
  const today = DateTime.now().setZone(timezone)
  const startOfGrid = today.minus({ weeks: 51 }).startOf('week')

  const weeks: { days: { date: string; count: number }[] }[] = []
  for (let w = 0; w < 52; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const dt = startOfGrid.plus({ weeks: w, days: d })
      const dateStr = dt.toISODate() ?? ''
      days.push({ date: dateStr, count: completionMap.get(dateStr) ?? 0 })
    }
    weeks.push({ days })
  }

  const getColor = (count: number) => {
    if (count === 0) return 'bg-white/5'
    if (count === 1) return 'bg-green-800/70'
    if (count <= 3) return 'bg-green-600/80'
    return 'bg-green-500'
  }

  const monthLabels: { label: string; weekIndex: number }[] = []
  for (let w = 0; w < 52; w++) {
    const day = startOfGrid.plus({ weeks: w }).toISODate() ?? ''
    const dt = DateTime.fromISO(day)
    if (dt.day <= 7) {
      monthLabels.push({ label: dt.toFormat('MMM'), weekIndex: w })
    }
  }

  return (
    <div className="glass-card p-4">
      <p className="section-label mb-3">Yearly Activity</p>
      <div className="relative">
        {/* Month labels */}
        <div className="flex mb-1 ml-6">
          {weeks.map((_, wi) => {
            const label = monthLabels.find(m => m.weekIndex === wi)
            return (
              <div key={wi} className="flex-1">
                {label && <span className="text-[8px] text-muted-foreground">{label.label}</span>}
              </div>
            )
          })}
        </div>
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1">
            {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => (
              <div key={i} className="h-2.5 flex items-center">
                <span className="text-[8px] text-muted-foreground w-4">{d}</span>
              </div>
            ))}
          </div>
          {/* Grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5 flex-1">
              {week.days.map((day, di) => (
                <div
                  key={di}
                  className={cn('h-2.5 rounded-[2px] cursor-pointer transition-opacity hover:opacity-80', getColor(day.count))}
                  title={day.date ? `${day.date}: ${day.count} completion${day.count !== 1 ? 's' : ''}` : ''}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-[9px] text-muted-foreground">Less</span>
        {[0, 1, 2, 4].map(c => (
          <div key={c} className={cn('h-2 w-2 rounded-[2px]', getColor(c))} />
        ))}
        <span className="text-[9px] text-muted-foreground">More</span>
      </div>
    </div>
  )
}

function DayOfWeekChart({ stats }: { stats: { day: string; avg: number }[] }) {
  const max = Math.max(...stats.map(s => s.avg), 1)
  return (
    <div className="glass-card p-4">
      <p className="section-label mb-4">Completion by Day of Week</p>
      <div className="flex items-end gap-2 h-24">
        {stats.map(({ day, avg }) => (
          <div key={day} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
              <div
                className="w-full rounded-t bg-primary transition-all duration-700"
                style={{ height: `${Math.max(2, (avg / max) * 80)}px` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground uppercase">{day}</span>
            <span className="text-[9px] font-bold tabular-nums">{avg}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsPage() {
  const [habitsData] = useAtom(habitsAtom)
  const [coinsData] = useAtom(coinsAtom)
  const [settings] = useAtom(settingsAtom)
  const xpData = useAtomValue(xpAtom)
  const maxStreak = useAtomValue(maxStreakAtom)
  const timezone = settings.system.timezone

  const habits = habitsData.habits

  const yearlyMap = useMemo(() => getYearlyCompletionMap(habits, timezone), [habits, timezone])
  const dowStats = useMemo(() => getDayOfWeekStats(habits, timezone), [habits, timezone])
  const perHabitStats = useMemo(() => getPerHabitStats(habits, timezone), [habits, timezone])
  const coinBreakdown = useMemo(() => getCoinBreakdown(coinsData.transactions), [coinsData.transactions])
  const correlations = useMemo(() => getHabitCorrelations(habits, timezone), [habits, timezone])

  const totalCompletions = habits.filter(h => !h.isTask).reduce((sum, h) => sum + h.completions.length, 0)
  const avgRate = perHabitStats.length > 0 ? Math.round(perHabitStats.reduce((s, h) => s + h.rate30d, 0) / perHabitStats.length) : 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">STATS</h1>
        <p className="section-label mt-1">YOUR FORGE ANALYTICS</p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Completions', value: totalCompletions.toLocaleString(), color: 'text-primary', icon: <TrendingUp className="h-4 w-4" /> },
          { label: 'Best Streak', value: `${maxStreak}d`, color: 'text-primary', icon: <Zap className="h-4 w-4" /> },
          { label: '30-Day Rate', value: `${avgRate}%`, color: 'text-emerald-400', icon: <BarChart3 className="h-4 w-4" /> },
          { label: 'Total XP', value: xpData.totalXP.toLocaleString(), color: 'text-violet-400', icon: <Calendar className="h-4 w-4" /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">{icon}<span className="section-label">{label}</span></div>
            <p className={cn('text-2xl font-black tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Yearly heatmap */}
      <YearlyHeatmap completionMap={yearlyMap} timezone={timezone} />

      {/* Day of week */}
      <DayOfWeekChart stats={dowStats} />

      {/* Per-habit stats */}
      {perHabitStats.length > 0 && (
        <div className="glass-card p-4">
          <p className="section-label mb-3">Habit Performance</p>
          <div className="space-y-2">
            {perHabitStats.slice(0, 10).map(({ habit, total, bestStreak: bs, rate30d }) => (
              <div key={habit.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 font-medium truncate">{habit.name}</span>
                <span className="text-muted-foreground tabular-nums w-12 text-right">{total}×</span>
                <span className="text-amber-400 tabular-nums w-12 text-right">{bs}d 🔥</span>
                <span className="text-emerald-400 tabular-nums w-12 text-right">{rate30d}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correlations */}
      {correlations.length > 0 && (
        <div className="glass-card p-4">
          <p className="section-label mb-3">Habit Correlations</p>
          <p className="text-xs text-muted-foreground mb-3">Habits you tend to do together</p>
          <div className="space-y-2">
            {correlations.slice(0, 5).map(c => (
              <div key={`${c.habitAId}-${c.habitBId}`} className="flex items-center gap-3">
                <span className="text-xs font-medium flex-1 truncate">{c.habitAName}</span>
                <span className="text-[10px] text-muted-foreground">+</span>
                <span className="text-xs font-medium flex-1 truncate">{c.habitBName}</span>
                <span className="text-sm font-black text-primary tabular-nums w-10 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coin breakdown */}
      <div className="glass-card p-4">
        <p className="section-label mb-3">Coin Flow</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Earned</p>
            <p className="text-xl font-black text-amber-400 tabular-nums">🪙 {coinBreakdown.earned.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-xl font-black text-red-400 tabular-nums">🪙 {coinBreakdown.spent.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
