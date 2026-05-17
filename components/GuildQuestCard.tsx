'use client'

import { GuildQuestWithProgress } from '@/app/actions/guilds'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

const DIFFICULTY_STYLES: Record<string, { label: string; color: string; border: string }> = {
  easy:   { label: 'EASY',   color: 'text-emerald-400', border: 'border-emerald-500/30' },
  medium: { label: 'MEDIUM', color: 'text-amber-400',   border: 'border-amber-500/30' },
  hard:   { label: 'HARD',   color: 'text-red-400',     border: 'border-red-500/30' },
}

function useCountdown(weekStart: string) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const update = () => {
      const end = new Date(weekStart)
      end.setDate(end.getDate() + 7)
      const ms = end.getTime() - Date.now()
      if (ms <= 0) { setTimeLeft('Expired'); return }
      const d = Math.floor(ms / 86400000)
      const h = Math.floor((ms % 86400000) / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      if (d > 0) setTimeLeft(`${d}d ${h}h`)
      else if (h > 0) setTimeLeft(`${h}h ${m}m`)
      else setTimeLeft(`${m}m`)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [weekStart])
  return timeLeft
}

interface GuildQuestCardProps {
  quest: GuildQuestWithProgress
}

export default function GuildQuestCard({ quest }: GuildQuestCardProps) {
  const styles = DIFFICULTY_STYLES[quest.difficulty] ?? DIFFICULTY_STYLES.easy
  const timeLeft = useCountdown(quest.weekStart)
  const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100))
  const allClaimed = quest.claimedBy.length > 0

  return (
    <div className={cn(
      'glass-card p-4 flex flex-col gap-3 border',
      quest.isComplete ? 'border-emerald-500/40' : styles.border
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{quest.emoji}</span>
          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', styles.color, styles.border)}>
            {styles.label}
          </span>
        </div>
        {!quest.isComplete && (
          <span className="text-[10px] text-muted-foreground tabular-nums">{timeLeft}</span>
        )}
        {quest.isComplete && (
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">COMPLETE ✓</span>
        )}
      </div>

      {/* Title & Description */}
      <div>
        <p className="font-bold text-sm leading-snug">{quest.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{quest.description}</p>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Progress</span>
          <span className={cn('font-bold tabular-nums', quest.isComplete ? 'text-emerald-400' : 'text-foreground')}>
            {quest.progress.toLocaleString()} / {quest.target.toLocaleString()}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              quest.isComplete ? 'bg-emerald-500' : 'bg-primary'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Rewards */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Reward:</span>
        {quest.reward.coins > 0 && <span className="text-xs font-semibold text-amber-400">🪙 {quest.reward.coins}</span>}
        {quest.reward.xp > 0 && <span className="text-xs font-semibold text-violet-400">⚡ {quest.reward.xp} XP</span>}
        {quest.reward.gems > 0 && <span className="text-xs font-semibold text-cyan-400">💎 {quest.reward.gems}</span>}
      </div>

      {/* Auto-distributed state */}
      {allClaimed && (
        <div className="text-xs text-emerald-400 font-semibold text-center py-1 bg-emerald-500/10 rounded-md">
          Rewards distributed to all members!
        </div>
      )}
    </div>
  )
}
