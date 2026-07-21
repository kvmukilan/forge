'use client'

import { useAtomValue } from 'jotai'
import { dailyChallengeAtom, dailyChallengeProgressAtom } from '@/lib/gamification-atoms'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DailyChallenge() {
  const challenge = useAtomValue(dailyChallengeAtom)
  const progress = useAtomValue(dailyChallengeProgressAtom)

  const pct = Math.min(100, Math.round((progress.current / progress.target) * 100))

  return (
    <div className={cn(
      'relative h-full overflow-hidden rounded-xl border bg-card',
      progress.isComplete
        ? 'border-emerald-500/20'
        : 'border-amber-500/20'
    )}>
      <div className="flex h-full flex-col p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className={cn(
              'text-[10px] font-black uppercase tracking-[0.12em] mb-1',
              progress.isComplete ? 'text-emerald-400' : 'text-amber-400'
            )}>
              {progress.isComplete ? '✓ Mission Complete' : "Today's Mission"}
            </p>
            <p className={cn(
              'font-bold text-sm leading-snug',
              progress.isComplete && 'text-emerald-300'
            )}>
              {challenge.label}
            </p>
          </div>
          <span className={cn(
            'flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full border flex-shrink-0 ml-3',
            progress.isComplete
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
          )}>
            <Zap className="h-3 w-3" />
            +{challenge.bonusXP} XP
          </span>
        </div>

        {/* Progress */}
        <div className="mt-auto space-y-2">
          <div className="flex justify-between items-center">
            <span className={cn(
              'text-xs font-bold tabular-nums',
              progress.isComplete ? 'text-emerald-400' : 'text-amber-400'
            )}>
              {progress.current} / {progress.target}
            </span>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
          <div className={cn(
            'h-2.5 rounded-full overflow-hidden border',
            progress.isComplete ? 'bg-emerald-950/40 border-emerald-500/10' : 'bg-amber-950/30 border-amber-500/10'
          )}>
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                progress.isComplete ? 'bg-emerald-500' : 'bg-amber-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
