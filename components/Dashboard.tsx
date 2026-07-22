'use client'

import { useAtom, useAtomValue } from 'jotai'
import Link from 'next/link'
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
import { ChevronDown, Coins, Sun, CloudSun, Moon, Gift, Loader2, Map, Sparkles, UserRound } from 'lucide-react'
import { useAchievements } from '@/hooks/useAchievements'
import { getOrSpawnBoss } from '@/app/actions/gamification'
import { getProgressionSummary } from '@/app/actions/progression'
import { loadHabitsData } from '@/app/actions/data'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

  const [habitsData, setHabitsData] = useAtom(habitsAtom)
  const [settingsData] = useAtom(settingsAtom)
  const [wishlist] = useAtom(wishlistAtom)
  const [, setBossData] = useAtom(bossAtom)
  const [worldOpen, setWorldOpen] = useState(false)
  const [recoveringProgram, setRecoveringProgram] = useState(habitsData.habits.length === 0)
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
    if (habits.length > 0) {
      setRecoveringProgram(false)
      return
    }

    let cancelled = false
    const recoverFirstProgram = async () => {
      try {
        const summary = await getProgressionSummary()
        if (!summary) {
          if (!cancelled) router.push('/onboarding')
          return
        }

        // A Neon write can become visible to one warm Vercel function before
        // another. Retry the user-scoped snapshot briefly instead of showing an
        // empty planner immediately after a successful activation.
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const fresh = await loadHabitsData()
          if (fresh.habits.length > 0) {
            if (!cancelled) {
              setHabitsData(fresh)
              setRecoveringProgram(false)
            }
            return
          }
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
        }
      } catch {
        // The normal empty-state remains usable if recovery cannot complete.
      }
      if (!cancelled) setRecoveringProgram(false)
    }

    recoverFirstProgram()
    return () => { cancelled = true }
  }, [habits.length, router, setHabitsData])

  if (recoveringProgram) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" />
        <span className="sr-only">Loading your first quests</span>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <GreetingHeader />

      <StreakAtRiskBanner />

      <DailyForge habits={habits} />

      <details className="group overflow-hidden rounded-3xl border border-border/70 bg-card/55">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-base font-semibold">All due today</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Habits, tasks, and wishlist goals outside your focused plan.</p>
          </div>
          <ChevronDown className="h-5 w-5 flex-none text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="border-t border-border/70 p-3 sm:p-5">
          <DailyOverview
            wishlistItems={wishlistItems}
            habits={habits}
            coinBalance={Math.max(0, balance)}
          />
        </div>
      </details>

      <section className="space-y-4 pt-2" aria-labelledby="keep-growing-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold">Keep growing</span>
            </div>
            <h2 id="keep-growing-title" className="text-xl font-bold tracking-tight">Your progress has a place.</h2>
          </div>
          <p className="hidden max-w-sm text-right text-sm text-muted-foreground md:block">Review growth when you want it. Today stays focused on action.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { href: '/character', label: 'Character', detail: 'Attributes and level', icon: UserRound },
            { href: '/journey', label: 'Journey', detail: '66-day campaign map', icon: Map },
            { href: '/rewards', label: 'Rewards', detail: 'Milestones and unlocks', icon: Gift },
          ].map(item => (
            <Link key={item.href} href={item.href} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-border/75 bg-card px-4 py-3 outline-none transition-colors hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-ring">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-secondary text-muted-foreground transition-colors group-hover:text-primary">
                <item.icon className="h-5 w-5 stroke-[1.8]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.detail}</span>
              </span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setWorldOpen(open => !open)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/35 px-4 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={worldOpen}
          aria-controls="forge-world-details"
        >
          {worldOpen ? 'Hide world details' : 'Explore world details'}
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', worldOpen && 'rotate-180')} />
        </button>

        {worldOpen && (
          <div id="forge-world-details" className="space-y-4 rounded-3xl border border-border/70 bg-card/35 p-3 animate-fade-in sm:p-5">
            <CharacterCard />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2"><DailyQuests /></div>
              <div><CoinBalanceCard /></div>
            </div>
            <BossCard />
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <PartyStatusWidget />
              <PetCard compact={true} />
            </div>
            <SeasonBanner />
            <HabitStreak habits={habits} />
            <div className="relative">
              <div className="absolute -top-2 right-3 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Pattern insight
              </div>
              <HabitDNA />
            </div>
          </div>
        )}
      </section>

      <PerfectDayModal />
      <MilestoneModal />
    </div>
  )
}
