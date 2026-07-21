'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, Flame, Shield, Sparkles, Swords, Trophy } from 'lucide-react'
import { getProgressionSummary, type ProgressionSummary } from '@/app/actions/progression'
import { cn } from '@/lib/utils'

const CHAPTERS = ['Foundation', 'Momentum', 'Clarity', 'Resolve', 'Mastery', 'Continuation']

export default function JourneyPage() {
  const [summary, setSummary] = useState<ProgressionSummary | null | undefined>(undefined)
  useEffect(() => { getProgressionSummary().then(setSummary).catch(() => setSummary(null)) }, [])
  if (summary === undefined) return <div className="min-h-72 animate-pulse rounded-2xl border border-border bg-card" />
  if (!summary) return <div className="py-16 text-center"><Sparkles className="mx-auto h-8 w-8 text-primary" /><h1 className="mt-4 text-3xl font-bold">Begin before charting the journey.</h1><Link href="/onboarding" className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground">Take the assessment</Link></div>

  const currentChapter = Math.max(1, summary.campaign.chapter)
  const destinations = [
    { href: '/', icon: Swords, title: 'Weekly challenge', body: 'Daily completions damage the current boss.' },
    { href: '/skills', icon: Flame, title: 'Skill paths', body: 'Unlock practical bonuses through category consistency.' },
    { href: '/achievements', icon: Trophy, title: 'Milestones', body: 'Keep permanent evidence of the moments that mattered.' },
    { href: '/season', icon: Shield, title: 'Season', body: 'A rotating long-term modifier beyond the 66-day arc.' },
  ]
  return (
    <div className="space-y-7 animate-fade-in">
      <header><p className="section-label mb-2">The 66-day campaign</p><h1 className="page-title">A structure for momentum, not a deadline.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Every chapter lasts eleven days. Habits can take much longer or shorter to become automatic; the campaign simply gives progress a readable shape.</p></header>
      <section className="overflow-hidden rounded-3xl border border-border/80 bg-card p-5 shadow-[0_24px_80px_-52px_hsl(var(--primary)/0.55)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="section-label">Current arc</p><h2 className="mt-1 text-2xl font-bold">Chapter {currentChapter}: {CHAPTERS[currentChapter - 1] ?? 'Continuation'}</h2><p className="mt-1 text-sm text-muted-foreground">Campaign day {summary.campaign.day} · day {summary.campaign.chapterDay} of this chapter</p></div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{summary.rank.name}</span>
        </div>
        <div className="mt-6 grid grid-cols-6 gap-2">
          {CHAPTERS.map((chapter, index) => {
            const number = index + 1
            const complete = number < currentChapter || summary.campaign.isContinuing
            const active = number === currentChapter && !summary.campaign.isContinuing
            return <div key={chapter} className="min-w-0"><div className={cn('h-2 rounded-full', complete ? 'bg-cyan-400' : active ? 'bg-primary' : 'bg-secondary')} /><p className={cn('mt-2 hidden truncate text-xs font-semibold sm:block', active ? 'text-primary' : 'text-muted-foreground')}>{chapter}</p></div>
          })}
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {destinations.map(item => <Link key={item.href} href={item.href} className="group min-h-40 rounded-2xl border border-border bg-card p-5 outline-none transition-colors hover:border-primary/30 hover:bg-primary/[0.035] focus-visible:ring-2 focus-visible:ring-ring"><item.icon className="h-5 w-5 text-primary" /><h2 className="mt-4 font-semibold">{item.title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p><span className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">Open <ArrowRight className="h-4 w-4" /></span></Link>)}
      </section>
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/25 p-4 text-sm leading-relaxed text-muted-foreground"><BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" /><p><span className="font-semibold text-foreground">Recovery is part of progression.</span> A reduced plan, rest day, or streak shield preserves the ability to return; it is not treated as failure.</p></div>
    </div>
  )
}
