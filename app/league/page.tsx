'use client'

import { useEffect, useState } from 'react'
import { getMyLeague, type LeagueState } from '@/app/actions/retention'
import { LEAGUE_TIERS } from '@/lib/retention'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trophy, ArrowUp, ArrowDown, Minus, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIER_COLORS = [
  'text-amber-600',   // Bronze
  'text-slate-300',   // Silver
  'text-yellow-400',  // Gold
  'text-violet-400',  // Obsidian
  'text-primary',     // Ember
]

function ZoneIcon({ zone }: { zone: 'promote' | 'stay' | 'demote' }) {
  if (zone === 'promote') return <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
  if (zone === 'demote') return <ArrowDown className="h-3.5 w-3.5 text-destructive" />
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/50" />
}

export default function LeaguePage() {
  const [league, setLeague] = useState<LeagueState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyLeague()
      .then(setLeague)
      .catch(() => setLeague(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">LEAGUE</h1>
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">Loading standings…</div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">LEAGUE</h1>
        <div className="glass-card p-8 text-center space-y-3">
          <Swords className="h-8 w-8 text-primary mx-auto" />
          <p className="text-sm font-bold">Complete your first habit to enter the league</p>
          <p className="text-xs text-muted-foreground">
            Every week you compete in a small group. Top 3 climb a tier, bottom 3 drop one.
          </p>
        </div>
      </div>
    )
  }

  const myRank = league.standings.findIndex(s => s.isMe) + 1

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <h1 className="page-title">LEAGUE</h1>
        <span className="text-xs text-muted-foreground font-semibold">
          {league.endsInDays === 0 ? 'Ends today' : `Ends in ${league.endsInDays}d`}
        </span>
      </div>

      {/* Tier header */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Trophy className={cn('h-6 w-6', TIER_COLORS[league.tier - 1])} />
          </div>
          <div className="flex-1">
            <p className={cn('text-lg font-black uppercase tracking-wide', TIER_COLORS[league.tier - 1])}>
              {league.tierName} League
            </p>
            <p className="text-xs text-muted-foreground">
              You are #{myRank} of {league.standings.length} · top 3 promote, bottom 3 drop
            </p>
          </div>
        </div>
        {/* Tier ladder */}
        <div className="flex items-center gap-1.5 mt-4">
          {LEAGUE_TIERS.map((name, i) => (
            <div key={name} className="flex-1 text-center">
              <div className={cn(
                'h-1.5 rounded-full mb-1',
                i + 1 === league.tier ? 'bg-primary' : i + 1 < league.tier ? 'bg-primary/40' : 'bg-secondary'
              )} />
              <span className={cn(
                'text-[9px] font-bold uppercase tracking-wide',
                i + 1 === league.tier ? 'text-primary' : 'text-muted-foreground/60'
              )}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Standings */}
      <div className="glass-card divide-y divide-border">
        {league.standings.map((standing, i) => (
          <div
            key={standing.userId}
            className={cn(
              'flex items-center gap-3 px-4 py-3',
              standing.isMe && 'bg-primary/5 border-l-2 border-l-primary'
            )}
          >
            <span className={cn(
              'w-6 text-center text-sm font-black tabular-nums',
              i < 3 ? 'text-primary' : 'text-muted-foreground'
            )}>
              {i + 1}
            </span>
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={standing.avatarPath ? `/api/avatars/${standing.avatarPath.split('/').pop()}` : undefined} />
              <AvatarFallback className="bg-secondary text-xs font-bold">
                {standing.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className={cn('flex-1 text-sm font-semibold truncate', standing.isMe && 'text-primary')}>
              {standing.username}{standing.isMe && ' (you)'}
            </span>
            <span className="text-sm font-bold tabular-nums">{standing.score}</span>
            <ZoneIcon zone={standing.zone} />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Score = habit completions this week, weighted by difficulty. Resets Monday.
      </p>
    </div>
  )
}
