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
  normal:  { label: 'WEEKLY THREAT · ACTIVE',    color: 'text-red-400',    border: 'border-red-500/25',    bg: 'from-red-950/50 via-background to-orange-950/20'    },
  enraged: { label: 'PHASE 2 · ENRAGED',          color: 'text-orange-400', border: 'border-orange-500/40', bg: 'from-orange-950/60 via-background to-red-950/30'    },
  final:   { label: 'FINAL STAND · DO NOT FAIL',  color: 'text-red-300',    border: 'border-red-400/60',    bg: 'from-red-950/70 via-background to-purple-950/30'    },
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

  const hpBarColor =
    phase === 'final'   ? 'from-red-800 to-purple-600' :
    phase === 'enraged' ? 'from-orange-600 to-red-500' :
                          'from-red-600 to-orange-500'

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
      'relative rounded-2xl overflow-hidden border transition-all',
      boss.isDefeated
        ? 'border-emerald-500/20 bg-emerald-950/10'
        : cn(phaseConfig.border),
      phase === 'final' && !boss.isDefeated && 'shadow-[0_0_24px_rgba(239,68,68,0.15)]'
    )}>
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br',
        boss.isDefeated ? 'from-emerald-950/40 via-background to-teal-950/20' : phaseConfig.bg
      )} />
      {phase === 'enraged' && !boss.isDefeated && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,146,60,0.12),transparent_60%)]" />
      )}
      {phase === 'final' && !boss.isDefeated && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.15),transparent_70%)]" />
      )}

      <div className="relative p-5">
        {boss.isDefeated ? (
          <div className="flex flex-col items-center py-2 text-center gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-amber-400" />
              <p className="font-black text-xl text-emerald-400">{boss.emoji} {boss.name} Defeated!</p>
            </div>
            {boss.rewardClaimed ? (
              <p className="text-sm text-muted-foreground">
                Reward claimed: <span className="text-amber-400 font-semibold">+{boss.reward.coins} coins</span> · <span className="text-violet-400 font-semibold">+{boss.reward.xp} XP</span>
              </p>
            ) : (
              <div className="space-y-2 w-full">
                <p className="text-sm text-muted-foreground">
                  Claim your reward: <span className="text-amber-400 font-semibold">+{boss.reward.coins} coins</span> · <span className="text-violet-400 font-semibold">+{boss.reward.xp} XP</span>
                </p>
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full py-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-amber-300 transition-all disabled:opacity-50"
                >
                  {claiming ? 'Claiming...' : '🏆 Claim Reward'}
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
                  'p-2 rounded-xl border',
                  phase === 'final'   ? 'bg-red-500/30 border-red-400/50' :
                  phase === 'enraged' ? 'bg-orange-500/25 border-orange-500/40' :
                                        'bg-red-500/20 border-red-500/30'
                )}>
                  {phase === 'final'   ? <Skull className="h-5 w-5 text-red-300" /> :
                   phase === 'enraged' ? <Flame className="h-5 w-5 text-orange-400" /> :
                                         <Swords className="h-5 w-5 text-red-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-400">Weekly Boss</p>
                    {isCritical && (
                      <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse-subtle">
                        CRITICAL
                      </span>
                    )}
                    {phase !== 'normal' && (
                      <span className={cn(
                        'text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border',
                        phase === 'final'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse-subtle'
                          : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                      )}>
                        {phase === 'final' ? 'FINAL STAND' : 'ENRAGED'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-3xl font-black leading-tight">
                    {boss.emoji} {boss.name}
                  </h3>
                  <p className={cn('section-label mt-0.5', phaseConfig.color)}>{phaseConfig.label}</p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Time left</p>
                <p className={cn('text-base font-black tabular-nums', isUrgent ? 'text-red-400' : 'text-orange-400')}>
                  {countdown}
                </p>
                {isUrgent && <p className="text-[9px] text-red-400/80 font-bold uppercase tracking-wide">⚠ Urgent</p>}
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground font-medium">Boss HP</span>
                <span className={cn('text-xs font-black tabular-nums', isCritical ? 'text-red-400' : 'text-muted-foreground')}>
                  {boss.currentHP} / {boss.maxHP}
                  <span className="ml-1 text-muted-foreground/60">({hpPct}%)</span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden border border-white/[0.08]">
                <div
                  className={cn(
                    'h-full rounded-full bg-gradient-to-r transition-all duration-700',
                    hpBarColor,
                    (isCritical || phase === 'final') && 'animate-pulse-subtle'
                  )}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
              {phase !== 'normal' && (
                <div className="mt-1.5 h-0.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-white/10 to-white/5" style={{ width: `${hpPct}%` }} />
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{PHASE_TIPS[phase]}{' '}
              Defeat for{' '}
              <span className="text-amber-400 font-semibold">+{boss.reward.coins} coins</span>
              {' '}+{' '}
              <span className="text-violet-400 font-semibold">+{boss.reward.xp} XP</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
