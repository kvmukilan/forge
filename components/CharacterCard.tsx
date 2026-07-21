'use client'

import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { currentLevelAtom, xpProgressAtom, maxStreakAtom, xpEarnedTodayAtom, xpAtom, shieldsAtom } from '@/lib/gamification-atoms'
import { currentUserAtom, coinsAtom } from '@/lib/atoms'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowRight, Shield, Sparkles } from 'lucide-react'
import LevelUpModal from './LevelUpModal'
import { getProgressionSummary, type ProgressionSummary } from '@/app/actions/progression'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '@/lib/progression'

export default function CharacterCard({
  initialProgression = null,
  showAttributes = true,
}: {
  initialProgression?: ProgressionSummary | null
  showAttributes?: boolean
}) {
  const currentUser = useAtomValue(currentUserAtom)
  const level = useAtomValue(currentLevelAtom)
  const progress = useAtomValue(xpProgressAtom)
  const maxStreak = useAtomValue(maxStreakAtom)
  const shields = useAtomValue(shieldsAtom)
  const xpToday = useAtomValue(xpEarnedTodayAtom)
  const coinsData = useAtomValue(coinsAtom)
  const xpData = useAtomValue(xpAtom)
  const [progression, setProgression] = useState<ProgressionSummary | null>(initialProgression)

  useEffect(() => {
    const refresh = () => getProgressionSummary().then(setProgression).catch(() => setProgression(null))
    refresh()
    window.addEventListener('forge:progression-updated', refresh)
    return () => window.removeEventListener('forge:progression-updated', refresh)
  }, [])

  const balance = Math.max(0, coinsData.transactions.reduce((sum, t) => sum + t.amount, 0))
  const username = currentUser?.username ?? 'Hero'
  const avatarSrc = currentUser?.avatarPath ? `/api/avatars/${currentUser.avatarPath.split('/').pop()}` : ''
  const activeTitle = xpData.activeTitle

  return (
    <>
      <LevelUpModal />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-14 w-14 ring-2 ring-primary/40 flex-shrink-0">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback className="bg-primary/20 text-primary text-lg font-black">
              {username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="truncate text-lg font-bold">{username}</h2>
              <span className="level-badge flex-shrink-0">Lv {level}</span>
              {progression && <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{progression.rank.name}</span>}
            </div>
            {activeTitle && (
              <p className="text-xs text-primary/80 font-semibold mb-1.5 uppercase tracking-wide">{activeTitle}</p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>XP</span>
              <span>{progress.current} / {progress.needed}</span>
            </div>
            <div className="xp-bar-track">
              <div className="xp-bar-fill" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
          {[
            { label: 'Level', value: level, color: 'text-primary' },
            {
              label: 'Streak',
              value: (
                <span className="inline-flex items-center gap-1">
                  {maxStreak}d
                  {shields > 0 && (
                    <span className="inline-flex items-center text-xs font-bold text-sky-400" title={`${shields} streak shield${shields > 1 ? 's' : ''} active`}>
                      <Shield className="h-3.5 w-3.5 fill-current" />
                      {shields > 1 && <span className="ml-0.5">{shields}</span>}
                    </span>
                  )}
                </span>
              ),
              color: 'text-primary',
            },
            { label: 'Coins', value: balance.toLocaleString(), color: 'text-amber-400' },
            { label: 'XP Today', value: `+${xpToday}`, color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex min-h-16 flex-col items-center justify-center rounded-xl bg-background/30 py-2">
              <span className="section-label mb-1">{label}</span>
              <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        {progression && showAttributes ? (
          <div className="mt-5 border-t border-border/80 pt-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="section-label">Awakened attributes</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {progression.campaign.isContinuing
                    ? `Beyond the 66-day campaign · Chapter ${progression.campaign.chapter}`
                    : `Campaign day ${progression.campaign.day} · Chapter ${progression.campaign.chapter}`}
                </p>
              </div>
              <Link href="/character" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">Full character <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ATTRIBUTE_KEYS.map(key => {
                const attribute = progression.attributes[key]
                return (
                  <div key={key} className="rounded-xl border border-border/80 bg-background/35 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">{ATTRIBUTE_LABELS[key]}</span>
                      <span className="text-sm font-bold text-primary">{attribute.level}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${attribute.pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">{attribute.currentXP}/{attribute.neededXP} XP</p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : !progression ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-secondary/35 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div><p className="text-sm font-semibold">Reveal your starting attributes</p><p className="mt-0.5 text-xs text-muted-foreground">A short, editable assessment creates your personal progression path.</p></div>
            </div>
            <Link href="/onboarding" className="inline-flex min-h-11 flex-shrink-0 items-center justify-center gap-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring">Begin <ArrowRight className="h-4 w-4" /></Link>
          </div>
        ) : null}
      </div>
    </>
  )
}
