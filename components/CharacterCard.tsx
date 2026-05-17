'use client'

import { useAtomValue } from 'jotai'
import { currentLevelAtom, xpProgressAtom, maxStreakAtom, xpEarnedTodayAtom, xpAtom } from '@/lib/gamification-atoms'
import { currentUserAtom, coinsAtom } from '@/lib/atoms'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import LevelUpModal from './LevelUpModal'

export default function CharacterCard() {
  const currentUser = useAtomValue(currentUserAtom)
  const level = useAtomValue(currentLevelAtom)
  const progress = useAtomValue(xpProgressAtom)
  const maxStreak = useAtomValue(maxStreakAtom)
  const xpToday = useAtomValue(xpEarnedTodayAtom)
  const coinsData = useAtomValue(coinsAtom)
  const xpData = useAtomValue(xpAtom)

  const balance = Math.max(0, coinsData.transactions.reduce((sum, t) => sum + t.amount, 0))
  const username = currentUser?.username ?? 'Hero'
  const avatarSrc = currentUser?.avatarPath ? `/api/avatars/${currentUser.avatarPath.split('/').pop()}` : ''
  const activeTitle = xpData.activeTitle

  return (
    <>
      <LevelUpModal />
      <div className="glass-card p-5">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-14 w-14 ring-2 ring-primary/40 flex-shrink-0">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback className="bg-primary/20 text-primary text-lg font-black">
              {username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-black truncate">{username}</h2>
              <span className="level-badge flex-shrink-0">Lv {level}</span>
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

        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border">
          {[
            { label: 'Level', value: level, color: 'text-primary' },
            { label: 'Streak', value: `${maxStreak}d`, color: 'text-primary' },
            { label: 'Coins', value: balance.toLocaleString(), color: 'text-amber-400' },
            { label: 'XP Today', value: `+${xpToday}`, color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center py-1.5">
              <span className="section-label mb-1">{label}</span>
              <span className={`text-xl font-black tabular-nums ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
