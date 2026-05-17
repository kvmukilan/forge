'use client'

import { useAtomValue } from 'jotai'
import { currentSeasonAtom } from '@/lib/gamification-atoms'
import { getDaysRemainingInSeason } from '@/lib/seasons'
import Link from 'next/link'

export default function SeasonBanner() {
  const season = useAtomValue(currentSeasonAtom)
  if (!season) return null

  const daysLeft = getDaysRemainingInSeason(season)
  const hasBonuses = season.xpBonus > 0 || season.coinBonus > 0

  return (
    <Link href="/season" className="block">
      <div className="glass-card p-3 flex items-center gap-3 hover:border-primary/30 transition-colors">
        <span className="text-xl flex-shrink-0">{season.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Season {season.number}</span>
            <span className="text-xs font-bold truncate">{season.name}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {daysLeft}d remaining
            {hasBonuses && (
              <>
                {season.xpBonus > 0 && <span className="ml-2 text-violet-400">+{season.xpBonus}% XP</span>}
                {season.coinBonus > 0 && <span className="ml-2 text-amber-400">+{season.coinBonus}% Coins</span>}
              </>
            )}
          </p>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">→</span>
      </div>
    </Link>
  )
}
