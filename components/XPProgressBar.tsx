'use client'

import { cn } from '@/lib/utils'

interface XPProgressBarProps {
  current: number
  needed: number
  pct: number
  level: number
  compact?: boolean
  className?: string
}

export default function XPProgressBar({ current, needed, pct, level, compact = false, className }: XPProgressBarProps) {
  const isMaxLevel = needed === 0

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="level-badge">Lv {level}</span>
        <div className="xp-bar-track flex-1 h-1.5">
          <div
            className="xp-bar-fill h-full"
            style={{ width: `${isMaxLevel ? 100 : pct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {isMaxLevel ? 'MAX LEVEL' : `${current.toLocaleString()} / ${needed.toLocaleString()} XP`}
        </span>
        <span className="text-xs text-muted-foreground">{isMaxLevel ? '' : `${pct}%`}</span>
      </div>
      <div className="xp-bar-track">
        <div
          className="xp-bar-fill"
          style={{ width: `${isMaxLevel ? 100 : pct}%` }}
        />
      </div>
    </div>
  )
}
