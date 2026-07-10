'use client'

import { useAtom } from 'jotai'
import { bossAtom, xpAtom } from '@/lib/gamification-atoms'
import { settingsAtom, coinsAtom } from '@/lib/atoms'
import { getBossCountdownMs, formatCountdown } from '@/lib/gamification'
import { defeatBossAndClaim } from '@/app/actions/gamification'
import { useEffect, useState } from 'react'
import { Swords, Flame, Skull, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

function getBossPhase(hpPct: number): 'normal' | 'enraged' | 'final' {
  if (hpPct <= 25) return 'final'
  if (hpPct <= 55) return 'enraged'
  return 'normal'
}

const PHASE_LABELS = {
  normal:  { label: 'WEEKLY THREAT · ACTIVE',    color: 'text-red-400', border: 'border-red-500/25' },
  enraged: { label: 'PHASE 2 · ENRAGED',          color: 'text-primary', border: 'border-primary/40' },
  final:   { label: 'FINAL STAND · DO NOT FAIL',  color: 'text-red-400', border: 'border-red-500/60' },
}

const PHASE_TIPS = {
  normal:  'Every habit you complete deals 1 damage.',
  enraged: '⚠ Boss is enraged — complete habits before time runs out!',
  final:   '💀 Final Stand! One last push to defeat it!',
}

export default function BossCard() {
  const [bossData, setBossData] = useAtom(bossAtom)
  const [, setXPData] = useAtom(xpAtom)
  const [, setCoinsData] = useAtom(coinsAtom)
  const [settings] = useAtom(settingsAtom)
  const [countdown, setCountdown] = useState('')
  const [countdownMs, setCountdownMs] = useState(Infinity)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!bossData.boss) return
    const update = () => {
      const ms = getBossCountdownMs(bossData.boss!.weekStart, settings.system.timezone)
      setCountdownMs(ms)
      setCountdown(formatCountdown(ms))
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [bossData.boss, settings.system.timezone])

  if (!bossData.boss) return null
  const boss = bossData.boss
  const hpPct = Math.max(0, Math.round((boss.currentHP / boss.maxHP) * 100))
  const phase = getBossPhase(hpPct)
  const phaseConfig = PHASE_LABELS[phase]
  const isCritical = hpPct < 20
  const isUrgent = countdownMs < 24 * 60 * 60 * 1000

  const hpBarColor = phase === 'enraged' ? 'bg-primary' : 'bg-red-500'

  const handleClaim = async () => {
    setClaiming(true)
    try {
      const result = await defeatBossAndClaim()
      setBossData(result.bossData)
      setXPData(result.xpData)
      const { loadCoinsData } = await import('@/app/actions/data')
      const fresh = await loadCoinsData()
      setCoinsData(fresh)
      toast({
        title: `🏆 Rewards claimed!`,
        description: `+${boss.reward.coins} coins · +${boss.reward.xp} XP`,
      })
    } catch {
      toast({ title: 'Error claiming reward', variant: 'destructive' })
    }
    setClaiming(false)
  }

  return (
    <div className={cn(
      'rounded-lg overflow-hidden border bg-card transition-colors',
      boss.isDefeated ? 'border-emerald-500/20' : phaseConfig.border
    )}>
      <div className="p-5">
        {boss.isDefeated ? (
          <div className="flex flex-col items-center py-2 text-center gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <p className="font-extrabold text-lg text-emerald-400">{boss.emoji} {boss.name} Defeated!</p>
            </div>
            {boss.rewardClaimed ? (
              <p className="text-sm text-muted-foreground">
                Reward claimed: <span className="text-amber-400 font-semibold">+{boss.reward.coins} coins</span> · <span className="text-primary font-semibold">+{boss.reward.xp} XP</span>
              </p>
            ) : (
              <div className="space-y-2 w-full">
                <p className="text-sm text-muted-foreground">
                  Claim your reward: <span className="text-amber-400 font-semibold">+{boss.reward.coins} coins</span> · <span className="text-primary font-semibold">+{boss.reward.xp} XP</span>
                </p>
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full py-2.5 rounded-lg font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Trophy className="h-4 w-4" />
                  {claiming ? 'Claiming...' : 'Claim Reward'}
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">New boss spawns next Monday</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg border',
                  phase === 'enraged' ? 'bg-primary/10 border-primary/30' : 'bg-red-500/10 border-red-500/30'
                )}>
                  {phase === 'final'   ? <Skull className="h-5 w-5 text-red-400" /> :
                   phase === 'enraged' ? <Flame className="h-5 w-5 text-primary" /> :
                                         <Swords className="h-5 w-5 text-red-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="section-label text-red-400">Weekly Boss</p>
                    {isCritical && (
                      <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse-subtle">
                        CRITICAL
                      </span>
                    )}
                    {phase !== 'normal' && (
                      <span className={cn(
                        'text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border',
                        phase === 'final'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse-subtle'
                          : 'bg-primary/10 text-primary border-primary/30'
                      )}>
                        {phase === 'final' ? 'FINAL STAND' : 'ENRAGED'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-extrabold leading-tight">
                    {boss.emoji} {boss.name}
                  </h3>
                  <p className={cn('section-label mt-0.5', phaseConfig.color)}>{phaseConfig.label}</p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="section-label mb-0.5">Time left</p>
                <p className={cn('text-base font-extrabold tabular-nums', isUrgent ? 'text-red-400' : 'text-primary')}>
                  {countdown}
                </p>
                {isUrgent && <p className="text-xs text-red-400/80 font-bold uppercase tracking-wide">⚠ Urgent</p>}
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground font-medium">Boss HP</span>
                <span className={cn('text-xs font-extrabold tabular-nums', isCritical ? 'text-red-400' : 'text-muted-foreground')}>
                  {boss.currentHP} / {boss.maxHP}
                  <span className="ml-1 text-muted-foreground/60">({hpPct}%)</span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden border border-border">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    hpBarColor,
                    (isCritical || phase === 'final') && 'animate-pulse-subtle'
                  )}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{PHASE_TIPS[phase]}{' '}
              Defeat for{' '}
              <span className="text-amber-400 font-semibold">+{boss.reward.coins} coins</span>
              {' '}+{' '}
              <span className="text-primary font-semibold">+{boss.reward.xp} XP</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
