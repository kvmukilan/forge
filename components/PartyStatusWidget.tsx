'use client'

import { useEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { guildDataAtom } from '@/lib/gamification-atoms'
import { getGuildLeaderboard, getGuildQuests, GuildMemberStat, GuildQuestWithProgress } from '@/app/actions/guilds'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { currentUserAtom } from '@/lib/atoms'

export default function PartyStatusWidget() {
  const [guildData] = useAtom(guildDataAtom)
  const [currentUser] = useAtom(currentUserAtom)
  const [leaderboard, setLeaderboard] = useState<GuildMemberStat[]>([])
  const [topQuest, setTopQuest] = useState<GuildQuestWithProgress | null>(null)

  const myGuild = currentUser
    ? guildData.guilds.find(g => g.memberIds.includes(currentUser.id)) ?? null
    : null

  useEffect(() => {
    if (!myGuild) return
    getGuildLeaderboard(myGuild.id).then(setLeaderboard).catch(() => {})
    getGuildQuests(myGuild.id).then(quests => {
      const incomplete = quests.filter(q => !q.isComplete)
      if (incomplete.length > 0) {
        setTopQuest(incomplete.sort((a, b) => (b.progress / b.target) - (a.progress / a.target))[0])
      } else {
        setTopQuest(quests[0] ?? null)
      }
    }).catch(() => {})
  }, [myGuild?.id])

  if (!myGuild) {
    return (
      <Link href="/guild" className="block">
        <div className="glass-card p-4 flex items-center gap-3 hover:bg-white/5 transition-colors cursor-pointer">
          <div className="p-2 rounded-lg bg-violet-500/20">
            <Users className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="section-label">Party Status</p>
            <p className="text-sm font-semibold text-muted-foreground">Join or create a guild →</p>
          </div>
        </div>
      </Link>
    )
  }

  const maxCompletions = Math.max(1, ...leaderboard.map(m => m.weeklyCompletions))

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{myGuild.emoji}</span>
          <div>
            <p className="section-label">Party Status</p>
            <p className="text-sm font-bold">{myGuild.name}</p>
          </div>
        </div>
        <Link href="/guild" className="text-xs text-violet-400 hover:text-violet-300 font-semibold">
          View Guild →
        </Link>
      </div>
      <div className="space-y-2">
        {leaderboard.map((member, i) => {
          const pct = Math.round((member.weeklyCompletions / maxCompletions) * 100)
          const isMe = member.userId === currentUser?.id
          return (
            <div key={member.userId} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  {i === 0 && <span>👑</span>}
                  <span className={cn('font-semibold', isMe ? 'text-violet-300' : 'text-foreground')}>
                    {member.username}{isMe ? ' (you)' : ''}
                  </span>
                </div>
                <span className="text-muted-foreground tabular-nums">{member.weeklyCompletions}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500',
                    i === 0 ? 'bg-amber-400' : isMe ? 'bg-violet-500' : 'bg-white/30'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
        {leaderboard.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No activity this week yet</p>
        )}
      </div>
      {topQuest && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="section-label">Active Quest</span>
            <Link href="/guild" className="text-[10px] text-violet-400 hover:text-violet-300">View all →</Link>
          </div>
          <div className="flex items-center gap-2">
            <span>{topQuest.emoji}</span>
            <div className="flex-1">
              <p className="text-xs font-semibold truncate">{topQuest.title}</p>
              <div className="h-1.5 rounded-full bg-white/5 mt-1 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', topQuest.isComplete ? 'bg-emerald-500' : 'bg-primary')}
                  style={{ width: `${Math.min(100, Math.round((topQuest.progress / topQuest.target) * 100))}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {topQuest.progress}/{topQuest.target}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
