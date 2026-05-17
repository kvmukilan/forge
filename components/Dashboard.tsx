'use client'

import { useAtom, useAtomValue } from 'jotai'
import { wishlistAtom, habitsAtom, settingsAtom, coinsAtom, currentUserAtom } from '@/lib/atoms'
import { bossAtom } from '@/lib/gamification-atoms'
import DailyOverview from './DailyOverview'
import HabitStreak from './HabitStreak'
import CharacterCard from './CharacterCard'
import DailyChallenge from './DailyChallenge'
import BossCard from './BossCard'
import PartyStatusWidget from './PartyStatusWidget'
import PetCard from './PetCard'
import HabitDNA from './HabitDNA'
import PerfectDayModal from './PerfectDayModal'
import MilestoneModal from './MilestoneModal'
import SeasonBanner from './SeasonBanner'
import { Coins } from 'lucide-react'
import { useAchievements } from '@/hooks/useAchievements'
import { getOrSpawnBoss } from '@/app/actions/gamification'
import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import { cn } from '@/lib/utils'

function CoinBalanceCard() {
  const [coinsData] = useAtom(coinsAtom)
  const earnedToday = coinsData.transactions
    .filter(t => {
      const date = new Date(t.timestamp)
      const today = new Date()
      return date.toDateString() === today.toDateString() && t.amount > 0
    })
    .reduce((sum, t) => sum + t.amount, 0)
  const balance = coinsData.transactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="glass-card p-4 h-full flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-amber-500/20">
          <Coins className="h-4 w-4 text-amber-400" />
        </div>
        <span className="section-title">Coins</span>
      </div>
      <div>
        <p className="stat-number text-amber-400">{Math.max(0, balance).toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">+{earnedToday} earned today</p>
      </div>
    </div>
  )
}

function GreetingHeader() {
  const currentUser = useAtomValue(currentUserAtom)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    const name = currentUser?.username ?? 'Hero'
    if (hour < 12) setGreeting(`Good morning, ${name} ☀️`)
    else if (hour < 17) setGreeting(`Good afternoon, ${name} 🌤️`)
    else setGreeting(`Good evening, ${name} 🌙`)
  }, [currentUser])

  return greeting ? (
    <p className="text-sm text-muted-foreground font-medium">{greeting}</p>
  ) : null
}

function DailyVitality() {
  const [habitsData] = useAtom(habitsAtom)
  const [settings] = useAtom(settingsAtom)
  const timezone = settings.system.timezone
  const todayStr = DateTime.now().setZone(timezone).toISODate()!

  const habits = habitsData.habits.filter(h => !h.isTask && !h.archived)
  const total = habits.length
  const completed = habits.filter(h => {
    const target = h.targetCompletions ?? 1
    return h.completions.filter(c => DateTime.fromISO(c).setZone(timezone).toISODate() === todayStr).length >= target
  }).length

  const vitality = total > 0 ? Math.round((completed / total) * 100) : 0
  const remaining = total - completed

  const vitalityColor = vitality >= 80 ? 'text-emerald-400' : vitality >= 50 ? 'text-amber-400' : 'text-red-400'
  const barColor = vitality >= 80 ? 'from-emerald-500 to-emerald-400' : vitality >= 50 ? 'from-amber-500 to-amber-400' : 'from-red-500 to-red-400'

  return (
    <div className="glass-card p-5">
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="section-label mb-1">Daily Vitality</p>
          <div className="flex items-end gap-2">
            <span className={cn('text-6xl font-black tabular-nums leading-none', vitalityColor)}>{vitality}</span>
            <span className={cn('text-2xl font-bold mb-1', vitalityColor)}>%</span>
          </div>
          <p className="section-label mt-1">
            {vitality === 100 ? '✦ PERFECT DAY' : `${remaining} habit${remaining !== 1 ? 's' : ''} remaining`}
          </p>
        </div>
        <div className="flex gap-1 items-end">
          {Array.from({ length: 7 }).map((_, i) => {
            const day = DateTime.now().setZone(timezone).minus({ days: 6 - i })
            const dayStr = day.toISODate()!
            const dayCompleted = habits.filter(h => {
              const target = h.targetCompletions ?? 1
              return h.completions.filter(c => DateTime.fromISO(c).setZone(timezone).toISODate() === dayStr).length >= target
            }).length
            const dayPct = total > 0 ? dayCompleted / total : 0
            const isToday = i === 6
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={cn(
                  'w-6 rounded-sm transition-all',
                  isToday ? 'h-12 border border-white/20' : 'h-8',
                  dayPct >= 1 ? 'bg-emerald-500' :
                  dayPct >= 0.5 ? 'bg-emerald-700/60' :
                  dayPct > 0 ? 'bg-white/10' : 'bg-white/5'
                )} />
                <span className="text-[8px] text-muted-foreground uppercase">
                  {day.toFormat('EEE')[0]}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', barColor)}
          style={{ width: `${vitality}%` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  // Side-effect: check achievements on dashboard load
  useAchievements()

  const [habitsData] = useAtom(habitsAtom)
  const [settingsData] = useAtom(settingsAtom)
  const [wishlist] = useAtom(wishlistAtom)
  const [, setBossData] = useAtom(bossAtom)
  const habits = habitsData.habits
  const wishlistItems = wishlist.items

  // Calculate coin balance for DailyOverview
  const [coinsData] = useAtom(coinsAtom)
  const balance = coinsData.transactions.reduce((sum, t) => sum + t.amount, 0)

  // Spawn or retrieve boss on mount
  useEffect(() => {
    const timezone = settingsData.system.timezone
    const weekStart = DateTime.now().setZone(timezone).startOf('week').toISODate()!
    const habitCount = habits.filter(h => !h.isTask && !h.archived).length
    getOrSpawnBoss(weekStart, habitCount).then(setBossData).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5 animate-fade-in">
      <GreetingHeader />

      <SeasonBanner />

      <DailyVitality />

      <CharacterCard />

      <PartyStatusWidget />

      <PetCard compact={true} />

      <BossCard />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <DailyChallenge />
        </div>
        <div className="md:col-span-1">
          <CoinBalanceCard />
        </div>
      </div>

      <DailyOverview
        wishlistItems={wishlistItems}
        habits={habits}
        coinBalance={Math.max(0, balance)}
      />

      <HabitStreak habits={habits} />

      <HabitDNA />

      <PerfectDayModal />
      <MilestoneModal />
    </div>
  )
}
