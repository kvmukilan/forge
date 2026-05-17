'use client'

import { useAtomValue } from 'jotai'
import { currentSeasonAtom, xpAtom } from '@/lib/gamification-atoms'
import { SEASONS, getDaysRemainingInSeason, Season } from '@/lib/seasons'
import { Calendar, Trophy } from 'lucide-react'

function SeasonLeaderboard({ season }: { season: Season }) {
  const xpData = useAtomValue(xpAtom)
  const seasonStart = season.startDate
  const seasonEnd = season.endDate + 'T23:59:59Z'

  const xpThisSeason = (xpData.transactions ?? [])
    .filter(t => t.timestamp >= seasonStart && t.timestamp <= seasonEnd)
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="glass-card p-4">
      <p className="section-label mb-3">Your Season Progress</p>
      <div className="flex items-center gap-3">
        <div className="text-3xl font-black text-primary tabular-nums">{xpThisSeason.toLocaleString()}</div>
        <div>
          <p className="text-sm font-semibold">XP earned this season</p>
          <p className="text-xs text-muted-foreground">Keep grinding to unlock the season title</p>
        </div>
      </div>
    </div>
  )
}

export default function SeasonPage() {
  const season = useAtomValue(currentSeasonAtom)

  if (!season) {
    return (
      <div className="space-y-5 animate-fade-in">
        <h1 className="page-title">SEASONS</h1>
        <p className="text-muted-foreground">No active season right now.</p>
      </div>
    )
  }

  const daysLeft = getDaysRemainingInSeason(season)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Season {season.number}</span>
        </div>
        <h1 className="page-title">{season.name.toUpperCase()}</h1>
        <p className="text-muted-foreground text-sm mt-2 italic">"{season.theme}"</p>
      </div>

      {/* Season Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-3 text-center">
          <p className="section-label mb-1">Days Left</p>
          <p className="text-2xl font-black text-primary tabular-nums">{daysLeft}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="section-label mb-1">Season</p>
          <p className="text-2xl font-black">{season.emoji}</p>
        </div>
        {season.xpBonus > 0 && (
          <div className="glass-card p-3 text-center">
            <p className="section-label mb-1">XP Bonus</p>
            <p className="text-2xl font-black text-violet-400">+{season.xpBonus}%</p>
          </div>
        )}
        {season.coinBonus > 0 && (
          <div className="glass-card p-3 text-center">
            <p className="section-label mb-1">Coin Bonus</p>
            <p className="text-2xl font-black text-amber-400">+{season.coinBonus}%</p>
          </div>
        )}
      </div>

      {/* Season Dates */}
      <div className="glass-card p-4 flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground">
          {season.startDate} → {season.endDate}
        </span>
      </div>

      {/* XP Progress */}
      <SeasonLeaderboard season={season} />

      {/* Season Title unlock */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-bold">Season Title</p>
        </div>
        <p className="text-xs text-muted-foreground">Complete 50 habits this season to unlock the season-exclusive title.</p>
      </div>

      {/* Past Seasons */}
      <div>
        <p className="section-label mb-3">All Seasons</p>
        <div className="space-y-2">
          {SEASONS.map(s => (
            <div key={s.id} className={`glass-card p-3 flex items-center gap-3 ${s.id === season.id ? 'border-primary/40' : 'opacity-60'}`}>
              <span className="text-lg">{s.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-bold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.startDate} → {s.endDate}</p>
              </div>
              {s.id === season.id && <span className="text-[10px] font-bold text-primary uppercase">Active</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
