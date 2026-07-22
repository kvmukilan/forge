'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, RefreshCw, Sparkles } from 'lucide-react'
import CharacterCard from '@/components/CharacterCard'
import { getProgressionSummary, type ProgressionSummary } from '@/app/actions/progression'
import { ATTRIBUTE_DESCRIPTIONS, ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '@/lib/progression'

export default function CharacterPage() {
  const [summary, setSummary] = useState<ProgressionSummary | null | undefined>(undefined)
  useEffect(() => { getProgressionSummary().then(setSummary).catch(() => setSummary(null)) }, [])

  if (summary === undefined) return <div className="min-h-72 animate-pulse rounded-2xl border border-border bg-card" />
  if (!summary) return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h1 className="mt-5 text-3xl font-bold">Your attributes are waiting.</h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">Complete the editable assessment to establish a useful starting point and personal program.</p>
      <Link href="/onboarding" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring">Begin assessment <ArrowRight className="h-4 w-4" /></Link>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="section-label mb-2">Character</p><h1 className="page-title">Visible growth, grounded in action.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Starting values are editable self-reports. Earned progress comes only from completed real-world quests.</p></div>
        <Link href="/onboarding" className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><RefreshCw className="h-4 w-4" />Retake assessment</Link>
      </header>
      <CharacterCard initialProgression={summary} showAttributes={false} />
      <section>
        <div className="mb-3"><p className="section-label">Attribute record</p><h2 className="mt-1 text-xl font-bold">What each level represents</h2></div>
        <div className="grid gap-2 md:grid-cols-2">
          {ATTRIBUTE_KEYS.map(key => {
            const attribute = summary.attributes[key]
            const explanations = summary.profile.explanations[key] ?? []
            return (
              <details key={key} className="group rounded-xl border border-border bg-card">
                <summary className="min-h-11 cursor-pointer list-none p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{ATTRIBUTE_LABELS[key]}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{ATTRIBUTE_DESCRIPTIONS[key]}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <div className="text-right"><span className="text-2xl font-bold text-primary">{attribute.level}</span><p className="text-[11px] text-muted-foreground">base {attribute.base}</p></div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${attribute.pct}%` }} /></div>
                    <p className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">{attribute.currentXP}/{attribute.neededXP} XP</p>
                  </div>
                </summary>
                <div className="border-t border-border/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{attribute.earnedXP} XP earned since assessment</p>
                  {explanations.length > 0 && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{explanations.join(' ')}</p>}
                </div>
              </details>
            )
          })}
        </div>
      </section>
    </div>
  )
}
