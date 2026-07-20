'use client'

import { useAtom, useAtomValue } from 'jotai'
import { wishlistAtom, habitsAtom, settingsAtom, coinsAtom, currentUserAtom } from '@/lib/atoms'
import { bossAtom } from '@/lib/gamification-atoms'
import DailyOverview from './DailyOverview'
import HabitStreak from './HabitStreak'
import CharacterCard from './CharacterCard'
import DailyQuests from './DailyQuests'
import StreakAtRiskBanner from './StreakAtRiskBanner'
import BossCard from './BossCard'
import PartyStatusWidget from './PartyStatusWidget'
import PetCard from './PetCard'
import HabitDNA from './HabitDNA'
import PerfectDayModal from './PerfectDayModal'
import MilestoneModal from './MilestoneModal'
import SeasonBanner from './SeasonBanner'
import DailyForge from './DailyForge'
import { Coins, Sun, CloudSun, Moon, Orbit, Sparkles } from 'lucide-react'
import { useAchievements } from '@/hooks/useAchievements'
import { getOrSpawnBoss } from '@/app/actions/gamification'
import { getProgressionSummary } from '@/app/actions/progression'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DateTime } from 'luxon'

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
  const [period, setPeriod] = useState<'morning' | 'afternoon' | 'evening' | null>(null)

  useEffect(() => {
    const hour = new Date().getHours()
    const name = currentUser?.username ?? 'Hero'
    if (hour < 12) { setGreeting(`Good morning, ${name}`); setPeriod('morning') }
    else if (hour < 17) { setGreeting(`Good afternoon, ${name}`); setPeriod('afternoon') }
    else { setGreeting(`Good evening, ${name}`); setPeriod('evening') }
  }, [currentUser])

  const PeriodIcon = period === 'morning' ? Sun : period === 'afternoon' ? CloudSun : Moon

  return greeting ? (
    <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
      <PeriodIcon className="h-4 w-4" />
      {greeting}
    </p>
  ) : null
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

  // First-run: the server-backed profile is the source of truth. Existing
  // users with habits can opt into the assessment without being blocked.
  const router = useRouter()
  useEffect(() => {
    if (habits.length > 0) return
    getProgressionSummary().then(summary => {
      if (!summary) router.push('/onboarding')
    }).catch(() => {})
  }, [habits.length, router])

  return (
    <div className="space-y-5 animate-fade-in">
      <GreetingHeader />

      <StreakAtRiskBanner />

      <DailyForge habits={habits} />

      <DailyOverview
        wishlistItems={wishlistItems}
        habits={habits}
        coinBalance={Math.max(0, balance)}
      />

      <section className="pt-4 space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-3">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1.5">
              <Orbit className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Your world</span>
            </div>
            <h2 className="text-xl font-black tracking-tight">Progress beyond today</h2>
          </div>
          <p className="hidden sm:block text-xs text-muted-foreground max-w-xs text-right">Rewards, allies, and long-term growth—kept in view without competing with your priorities.</p>
        </div>

        <CharacterCard />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <DailyQuests />
          </div>
          <div className="md:col-span-1">
            <CoinBalanceCard />
          </div>
        </div>

        <BossCard />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <PartyStatusWidget />
          <PetCard compact={true} />
        </div>

        <SeasonBanner />

        <HabitStreak habits={habits} />

        <div className="relative">
          <div className="absolute -top-2 right-3 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Pattern insight
          </div>
          <HabitDNA />
        </div>
      </section>

      <PerfectDayModal />
      <MilestoneModal />
    </div>
  )
}
