'use client'

import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { guildDataAtom } from '@/lib/gamification-atoms'
import { currentUserAtom } from '@/lib/atoms'
import { createGuild, joinGuildByCode, leaveGuild, getGuildLeaderboard, getGuildActivity, getGuildQuests, GuildMemberStat, GuildActivityItem, GuildQuestWithProgress, loadGuildData } from '@/app/actions/guilds'
import GuildQuestCard from '@/components/GuildQuestCard'
import { toast } from '@/hooks/use-toast'
import { Users, Plus, LogOut, Copy, Check, Shield, Trophy, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DateTime } from 'luxon'

export default function GuildPage() {
  const [guildData, setGuildData] = useAtom(guildDataAtom)
  const [currentUser] = useAtom(currentUserAtom)

  const myGuild = currentUser
    ? guildData.guilds.find(g => g.memberIds.includes(currentUser.id)) ?? null
    : null

  const [leaderboard, setLeaderboard] = useState<GuildMemberStat[]>([])
  const [activity, setActivity] = useState<GuildActivityItem[]>([])
  const [quests, setQuests] = useState<GuildQuestWithProgress[]>([])
  const [codeCopied, setCodeCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const [createName, setCreateName] = useState('')
  const [createEmoji, setCreateEmoji] = useState('⚔️')
  const [createDesc, setCreateDesc] = useState('')

  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    if (!myGuild) return
    getGuildLeaderboard(myGuild.id).then(setLeaderboard).catch(() => {})
    getGuildActivity(myGuild.id).then(setActivity).catch(() => {})
    getGuildQuests(myGuild.id).then(setQuests).catch(() => {})
  }, [myGuild?.id])

  const handleCreate = async () => {
    if (!createName.trim()) return
    setLoading(true)
    const result = await createGuild(createName, createEmoji, createDesc)
    if (result.success && result.guild) {
      const fresh = await loadGuildData()
      setGuildData(fresh)
      toast({ title: result.message })
    } else {
      toast({ title: result.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setLoading(true)
    const result = await joinGuildByCode(joinCode)
    if (result.success) {
      const fresh = await loadGuildData()
      setGuildData(fresh)
      toast({ title: result.message })
    } else {
      toast({ title: result.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  const handleLeave = async () => {
    setLoading(true)
    const result = await leaveGuild()
    if (result.success) {
      const fresh = await loadGuildData()
      setGuildData(fresh)
      setLeaderboard([])
      setActivity([])
      toast({ title: result.message })
    } else {
      toast({ title: result.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  const copyInviteCode = () => {
    if (!myGuild) return
    navigator.clipboard.writeText(myGuild.inviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  if (!myGuild) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/20">
            <Users className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="page-title">Guild</h1>
            <p className="text-sm text-muted-foreground">Form a party. Conquer habits together.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-violet-400" />
              <p className="font-bold">Create a Guild</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={createEmoji}
                onChange={e => setCreateEmoji(e.target.value)}
                className="w-16 text-center text-xl bg-white/5 border-white/10"
                maxLength={2}
              />
              <Input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="Guild name"
                className="flex-1 bg-white/5 border-white/10"
              />
            </div>
            <Input
              value={createDesc}
              onChange={e => setCreateDesc(e.target.value)}
              placeholder="Description (optional)"
              className="bg-white/5 border-white/10"
            />
            <Button
              onClick={handleCreate}
              disabled={loading || !createName.trim()}
              className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Guild
            </Button>
          </div>

          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-amber-400" />
              <p className="font-bold">Join by Invite Code</p>
            </div>
            <p className="text-sm text-muted-foreground">Enter an 8-character code from a guild member.</p>
            <Input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              className="bg-white/5 border-white/10 font-mono text-center tracking-widest text-lg"
              maxLength={8}
            />
            <Button
              onClick={handleJoin}
              disabled={loading || joinCode.length < 6}
              variant="outline"
              className="w-full border-white/10"
            >
              Join Guild
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const maxCompletions = Math.max(1, ...leaderboard.map(m => m.weeklyCompletions))
  const isAdmin = myGuild.adminId === currentUser?.id

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{myGuild.emoji}</span>
            <div>
              <h1 className="text-2xl font-black">{myGuild.name}</h1>
              {myGuild.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{myGuild.description}</p>
              )}
              <p className="section-label mt-1">{myGuild.memberIds.length} member{myGuild.memberIds.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button
            onClick={handleLeave}
            disabled={loading}
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            {isAdmin && myGuild.memberIds.length === 1 ? 'Disband' : 'Leave'}
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
          <div>
            <p className="section-label">Invite Code</p>
            <p className="font-mono font-bold text-lg tracking-widest text-violet-300">{myGuild.inviteCode}</p>
          </div>
          <button
            onClick={copyInviteCode}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {codeCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Weekly Quests */}
      {quests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Weekly Quests</p>
            <p className="text-[10px] text-muted-foreground">
              {quests.filter(q => q.isComplete).length}/{quests.length} complete
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quests.map(quest => (
              <GuildQuestCard key={quest.id} quest={quest} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-400" />
            <div>
              <p className="section-label">Weekly Leaderboard</p>
              <p className="text-xs text-muted-foreground">Habit completions this week</p>
            </div>
          </div>
          <div className="space-y-3">
            {leaderboard.map((member, i) => {
              const pct = Math.round((member.weeklyCompletions / maxCompletions) * 100)
              const isMe = member.userId === currentUser?.id
              return (
                <div key={member.userId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-bold tabular-nums w-5 text-center',
                        i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'
                      )}>
                        {i === 0 ? '👑' : `#${i + 1}`}
                      </span>
                      <span className={cn('font-semibold', isMe ? 'text-violet-300' : '')}>
                        {member.username}{isMe ? ' ★' : ''}
                      </span>
                    </div>
                    <span className="text-muted-foreground tabular-nums text-xs">{member.weeklyCompletions} done</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700',
                        i === 0 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                        isMe ? 'bg-gradient-to-r from-violet-600 to-violet-400' :
                        'bg-white/20'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="section-label">Party Activity</p>
              <p className="text-xs text-muted-foreground">Recent completions</p>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No activity yet. Complete some habits!</p>
            ) : (
              activity.map((item, i) => {
                const isMe = item.userId === currentUser?.id
                const time = DateTime.fromISO(item.timestamp).toRelative() ?? ''
                return (
                  <div key={i} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-white/5 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className={cn('font-semibold', isMe ? 'text-violet-300' : 'text-foreground')}>
                        {item.username}
                      </span>
                      <span className="text-muted-foreground"> · {item.description}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-amber-400 font-semibold">+{item.amount}</div>
                      <div className="text-muted-foreground">{time}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
