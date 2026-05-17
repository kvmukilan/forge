'use client'

import { Habit } from '@/lib/types'
import { DateTime } from 'luxon'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface HabitHeatmapProps {
  habit: Habit
  timezone: string
}

export default function HabitHeatmap({ habit, timezone }: HabitHeatmapProps) {
  const WEEKS = 12
  const now = DateTime.now().setZone(timezone)
  const target = habit.targetCompletions ?? 1

  const completionsByDate = new Map<string, number>()
  for (const c of habit.completions) {
    const dateStr = DateTime.fromISO(c).setZone(timezone).toISODate()!
    completionsByDate.set(dateStr, (completionsByDate.get(dateStr) ?? 0) + 1)
  }

  // Build weeks: go back WEEKS*7 days, group by week
  const endDate = now.startOf('day')
  const startDate = endDate.minus({ days: WEEKS * 7 - 1 })

  const weeks: { date: DateTime; count: number; isFuture: boolean }[][] = []
  let current: typeof weeks[0] = []
  let cursor = startDate

  while (cursor <= endDate) {
    const dateStr = cursor.toISODate()!
    current.push({
      date: cursor,
      count: completionsByDate.get(dateStr) ?? 0,
      isFuture: false,
    })
    if (current.length === 7) {
      weeks.push(current)
      current = []
    }
    cursor = cursor.plus({ days: 1 })
  }
  if (current.length > 0) weeks.push(current)

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted/40'
    if (count >= target) return 'bg-green-500 dark:bg-green-400'
    return 'bg-green-800/60 dark:bg-green-700/60'
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex gap-0.5 overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((cell, di) => (
              <Tooltip key={di}>
                <TooltipTrigger asChild>
                  <div className={cn('h-2.5 w-2.5 rounded-[2px] cursor-default', getColor(cell.count))} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {cell.date.toLocaleString(DateTime.DATE_MED)}: {cell.count}/{target}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
    </TooltipProvider>
  )
}
