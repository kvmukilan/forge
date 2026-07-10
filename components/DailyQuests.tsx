'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { completedTodayCountAtom } from '@/lib/gamification-atoms'
import {
  getRetentionState, claimDailyLogin, claimDailyQuest,
  type RetentionState, type DailyQuestKey, type ChestSource,
} from '@/app/actions/retention'
import { useToast } from '@/hooks/use-toast'
import ChestOpenModal from './ChestOpenModal'
import { Check, Gift, Coins, Gem } from 'lucide-react'
import { cn } from '@/lib/utils'

function LoginStrip({ state, onChest }: { state: RetentionState['calendar']; onChest: () => void }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      {state.rewards.map((reward, i) => {
        const index = i + 1
        const isPast = index < state.streakIndex || (index === state.streakIndex && state.todayClaimed)
        const isToday = index === state.streakIndex && !state.todayClaimed
        return (
          <div key={index} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors',
                isPast && 'bg-primary/20 border-primary/40 text-primary',
                isToday && 'bg-primary text-primary-foreground border-primary animate-pulse',
                !isPast && !isToday && 'bg-secondary/60 border-border text-muted-foreground'
              )}
              title={reward.chest ? 'Mystery chest' : reward.coins ? `${reward.coins} coins` : `${reward.gems} gems`}
            >
              {isPast ? <Check className="h-3.5 w-3.5" />
                : reward.chest ? <Gift className="h-3.5 w-3.5" />
                : reward.coins ? <Coins className="h-3.5 w-3.5" />
                : <Gem className="h-3.5 w-3.5" />}
            </div>
            <span className={cn('text-[9px] font-semibold', isToday ? 'text-primary' : 'text-muted-foreground')}>
              {index}
            </span>
          </div>
        )
      })}
      <span className="sr-only">Day {state.streakIndex} of the login calendar</span>
      <button className="hidden" onClick={onChest} aria-hidden tabIndex={-1} />
    </div>
  )
}

export default function DailyQuests() {
  const [state, setState] = useState<RetentionState | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [chestSource, setChestSource] = useState<ChestSource | null>(null)
  const completedToday = useAtomValue(completedTodayCountAtom)
  const { toast } = useToast()

  const refresh = useCallback(async () => {
    try {
      const next = await getRetentionState()
      setState(next)
    } catch {
      // Panel is non-critical; stay hidden on failure
    }
  }, [])

  // Claim today's login on first load, then keep quest progress in sync with completions
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const current = await getRetentionState()
        if (cancelled || !current) return
        if (!current.calendar.todayClaimed) {
          const result = await claimDailyLogin()
          if (result?.claimed) {
            const { reward, streakIndex } = result
            toast({
              title: `Day ${streakIndex} login reward`,
              description: reward.chest ? 'A mystery chest is waiting!' : reward.coins ? `+${reward.coins} coins` : `+${reward.gems} gems`,
            })
          }
        }
        if (!cancelled) await refresh()
      } catch {
        // ignore
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    refresh()
  }, [completedToday, refresh])

  const handleClaim = async (key: DailyQuestKey) => {
    setClaiming(key)
    try {
      const result = await claimDailyQuest(key)
      if (result.success) {
        toast({ title: 'Quest complete', description: result.message })
        await refresh()
      } else {
        toast({ title: result.message, variant: 'destructive' })
      }
    } finally {
      setClaiming(null)
    }
  }

  if (!state) return null

  const chestAvailable: ChestSource | null =
    state.chests.daily_quests ? 'daily_quests'
      : state.chests.login_day7 ? 'login_day7'
        : null

  return (
    <div className="glass-card p-5 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="section-label">Daily Quests</p>
        {chestAvailable && (
          <button
            onClick={() => setChestSource(chestAvailable)}
            className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1 animate-pulse"
          >
            <Gift className="h-3.5 w-3.5" />
            Open chest
          </button>
        )}
      </div>

      <LoginStrip state={state.calendar} onChest={() => setChestSource('login_day7')} />

      <div className="space-y-2">
        {state.quests.map(quest => {
          const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100))
          return (
            <div key={quest.key} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className={cn('text-xs font-bold truncate', quest.claimed && 'text-muted-foreground line-through')}>
                    {quest.description}
                  </p>
                  <span className="text-[10px] text-muted-foreground tabular-nums ml-2 flex-shrink-0">
                    {quest.progress}/{quest.target}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', quest.claimed ? 'bg-muted-foreground/40' : 'bg-primary')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {quest.claimed ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : quest.isComplete ? (
                <button
                  onClick={() => handleClaim(quest.key)}
                  disabled={claiming === quest.key}
                  className="text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-3 py-1.5 hover:bg-primary/90 transition-colors flex-shrink-0 disabled:opacity-60"
                >
                  Claim
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground font-semibold flex-shrink-0">
                  +{quest.reward.coins}c
                </span>
              )}
            </div>
          )
        })}
      </div>

      {chestSource && (
        <ChestOpenModal
          source={chestSource}
          onClose={() => setChestSource(null)}
          onOpened={refresh}
        />
      )}
    </div>
  )
}
