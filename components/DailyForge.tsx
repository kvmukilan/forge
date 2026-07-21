'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAtomValue } from 'jotai'
import { DateTime } from 'luxon'
import {
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Check,
  ChevronRight,
  Circle,
  Flame,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { settingsAtom } from '@/lib/atoms'
import type { Habit } from '@/lib/types'
import {
  buildSuggestedPlan,
  ENERGY_LABELS,
  PLAN_CAPACITY,
  type DailyMood,
  type EnergyLevel,
} from '@/lib/daily-plan'
import {
  getCompletionsForDate,
  getNow,
  getTodayInTimezone,
  isHabitDue,
  isTaskOverdue,
} from '@/lib/utils'
import { getDailyPlan, saveDailyPlan } from '@/app/actions/daily-plan'
import {
  acceptAdaptation,
  dismissAdaptation,
  getAdaptationRecommendations,
  saveQuestFeedback,
  type HabitAdaptationRecommendation,
} from '@/app/actions/progression'
import { useHabits } from '@/hooks/useHabits'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ATTRIBUTE_LABELS, getAttributeRewardForDifficulty, getPrimaryAttributeForCategory, type EffortFeedback } from '@/lib/progression'

const ENERGY_ICONS: Record<EnergyLevel, typeof BatteryLow> = {
  low: BatteryLow,
  steady: BatteryMedium,
  high: BatteryFull,
}

const MOODS: { value: DailyMood; label: string }[] = [
  { value: 'drained', label: 'Drained' },
  { value: 'okay', label: 'Okay' },
  { value: 'good', label: 'Good' },
  { value: 'strong', label: 'Strong' },
]

function isComplete(habit: Habit, today: string, timezone: string): boolean {
  if (habit.isTask && habit.archived) return true
  return getCompletionsForDate({ habit, date: today, timezone }) >= (habit.targetCompletions ?? 1)
}

export default function DailyForge({ habits }: { habits: Habit[] }) {
  const settings = useAtomValue(settingsAtom)
  const timezone = settings.system.timezone
  const today = getTodayInTimezone(timezone)
  const todayDate = getNow({ timezone })
  const { completeHabit, undoComplete } = useHabits()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [energy, setEnergy] = useState<EnergyLevel>('steady')
  const [intention, setIntention] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [reflection, setReflection] = useState('')
  const [mood, setMood] = useState<DailyMood | null>(null)
  const [feedbackByCompletion, setFeedbackByCompletion] = useState<Record<string, EffortFeedback>>({})
  const [adaptation, setAdaptation] = useState<HabitAdaptationRecommendation | null>(null)
  const [adapting, setAdapting] = useState(false)

  const dueCandidates = useMemo(() => habits.filter(habit => {
    if (habit.archived) return false
    if (habit.pausedUntil && habit.pausedUntil >= today) return false
    const due = isHabitDue({ habit, timezone, date: todayDate }) || (habit.isTask && isTaskOverdue(habit, timezone))
    return due && !isComplete(habit, today, timezone)
  }), [habits, timezone, today, todayDate])

  const planItems = useMemo(() => selectedIds
    .map(id => habits.find(habit => habit.id === id))
    .filter((habit): habit is Habit => Boolean(habit)), [selectedIds, habits])

  const planningCandidates = useMemo(() => {
    const selected = selectedIds
      .map(id => habits.find(habit => habit.id === id))
      .filter((habit): habit is Habit => Boolean(habit))
    return [...selected, ...dueCandidates.filter(habit => !selectedIds.includes(habit.id))]
  }, [dueCandidates, habits, selectedIds])

  const completedCount = planItems.filter(habit => isComplete(habit, today, timezone)).length
  const progress = planItems.length > 0 ? Math.round((completedCount / planItems.length) * 100) : 0
  const planComplete = planItems.length > 0 && completedCount === planItems.length
  const feedbackTarget = planItems.find(habit => {
    if (!isComplete(habit, today, timezone)) return false
    const completionAt = [...habit.completions].reverse().find(value => DateTime.fromISO(value).setZone(timezone).toISODate() === today)
    return completionAt ? !feedbackByCompletion[completionAt] : false
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const existing = await getDailyPlan(today)
        if (cancelled) return
        if (existing) {
          setEnergy(existing.energy)
          setIntention(existing.intention)
          const availableIds = new Set(habits.map(habit => habit.id))
          setSelectedIds(existing.habitIds.filter(id => availableIds.has(id)))
          setReflection(existing.reflection)
          setMood(existing.mood)
          setSaved(true)
        } else {
          setSelectedIds(buildSuggestedPlan(dueCandidates, 'steady').map(item => item.id))
          setEditing(true)
        }
      } catch {
        if (!cancelled) setEditing(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // Habits are already hydrated when the dashboard mounts; reloading here on
    // every completion would overwrite an in-progress edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  useEffect(() => {
    getAdaptationRecommendations().then(items => setAdaptation(items[0] ?? null)).catch(() => {})
  }, [today])

  const updateEnergy = (nextEnergy: EnergyLevel) => {
    setEnergy(nextEnergy)
    const capacity = PLAN_CAPACITY[nextEnergy]
    setSelectedIds(current => {
      const available = new Set(habits.map(item => item.id))
      const retained = current.filter(id => available.has(id)).slice(0, capacity)
      const suggestions = buildSuggestedPlan(dueCandidates, nextEnergy).map(item => item.id)
      return [...retained, ...suggestions.filter(id => !retained.includes(id))].slice(0, capacity)
    })
  }

  const refreshSuggestions = () => {
    setSelectedIds(buildSuggestedPlan(dueCandidates, energy).map(item => item.id))
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(current => {
      if (current.includes(id)) return current.filter(itemId => itemId !== id)
      if (current.length >= PLAN_CAPACITY[energy]) {
        toast({
          title: `${ENERGY_LABELS[energy].label} plan is full`,
          description: `Choose up to ${PLAN_CAPACITY[energy]} priorit${PLAN_CAPACITY[energy] === 1 ? 'y' : 'ies'} or raise your energy setting.`,
        })
        return current
      }
      return [...current, id]
    })
  }

  const persistPlan = async (closeEditor = true) => {
    if (selectedIds.length === 0) {
      toast({ title: 'Choose at least one focus', description: 'A small plan is easier to protect than an empty one.' })
      return
    }
    setSaving(true)
    try {
      const next = await saveDailyPlan({
        planDate: today,
        energy,
        intention,
        habitIds: selectedIds,
        reflection,
        mood,
      })
      setEnergy(next.energy)
      setIntention(next.intention)
      setSelectedIds(next.habitIds)
      setReflection(next.reflection)
      setMood(next.mood)
      setSaved(true)
      if (closeEditor) setEditing(false)
      toast({ title: closeEditor ? 'Daily plan forged' : 'Reflection saved', description: closeEditor ? 'Your priorities are clear. Start with the first one.' : 'Progress recorded without judgment.' })
    } catch (error) {
      toast({
        title: 'Could not save the plan',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleCompletion = async (habit: Habit) => {
    setCompletingId(habit.id)
    try {
      if (isComplete(habit, today, timezone)) await undoComplete(habit)
      else await completeHabit(habit)
    } finally {
      setCompletingId(null)
    }
  }

  const recordEffort = async (habit: Habit, rating: EffortFeedback) => {
    const completionAt = [...habit.completions].reverse().find(value => DateTime.fromISO(value).setZone(timezone).toISODate() === today)
    if (!completionAt) return
    try {
      await saveQuestFeedback({ habitId: habit.id, completionAt, rating })
      setFeedbackByCompletion(current => ({ ...current, [completionAt]: rating }))
      toast({ title: 'Effort recorded', description: 'Future difficulty recommendations will use this signal.' })
    } catch {
      toast({ title: 'Could not save effort feedback', variant: 'destructive' })
    }
  }

  const applyAdaptation = async () => {
    if (!adaptation) return
    setAdapting(true)
    try {
      await acceptAdaptation({ habitId: adaptation.habitId, nextLevel: adaptation.nextLevel })
      toast({ title: adaptation.action === 'increase' ? 'Quest progressed' : 'Recovery version applied', description: 'Only this quest changed, and only by one step.' })
      window.location.reload()
    } catch (caught) {
      toast({ title: 'Could not update the quest', description: caught instanceof Error ? caught.message : 'Please try again.', variant: 'destructive' })
      setAdapting(false)
    }
  }

  const keepCurrentAdaptation = async () => {
    if (!adaptation) return
    await dismissAdaptation({ habitId: adaptation.habitId }).catch(() => {})
    setAdaptation(null)
  }

  const formattedDate = DateTime.fromISO(today).toFormat('cccc · LLL d')
  const EnergyIcon = ENERGY_ICONS[energy]

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-3xl border border-border/80 bg-card/70" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="sr-only">Loading today&apos;s plan</span>
      </div>
    )
  }

  if (editing) {
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="daily-plan-builder-title">
        <div className="space-y-7 p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary mb-2">
                <Flame className="h-4 w-4" />
                <span className="text-xs font-bold">Daily plan</span>
              </div>
              <h1 id="daily-plan-builder-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Build a day you can finish.</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Choose your capacity and protect only what matters today.</p>
            </div>
            <span className="hidden text-sm text-muted-foreground sm:block">{formattedDate}</span>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold">How much do you have today?</h2>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ENERGY_LABELS) as EnergyLevel[]).map(level => {
                const Icon = ENERGY_ICONS[level]
                const active = energy === level
                return (
                  <button
                    key={level}
                    onClick={() => updateEnergy(level)}
                    className={cn(
                      'group flex min-h-[92px] flex-col justify-between rounded-2xl border p-3 text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-28 sm:p-4',
                      active
                        ? 'border-primary bg-primary/[0.07]'
                        : 'border-border/80 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40'
                    )}
                    aria-pressed={active}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-[10px] font-black uppercase tracking-[0.14em]', active ? 'text-primary' : 'text-muted-foreground')}>
                        {PLAN_CAPACITY[level]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{ENERGY_LABELS[level].label}</p>
                    <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{ENERGY_LABELS[level].description}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">{PLAN_CAPACITY[level]} focus</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-6 lg:gap-8">
            <div className="space-y-3">
              <label htmlFor="daily-intention" className="text-sm font-semibold">Today counts if I…</label>
              <textarea
                id="daily-intention"
                value={intention}
                onChange={event => setIntention(event.target.value.slice(0, 160))}
                placeholder="Protect my focus and finish what matters."
                rows={4}
                className="w-full resize-none rounded-2xl border border-border bg-background/55 px-4 py-3 text-base leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              {energy === 'low' && (
                <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3 text-sm leading-relaxed text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                  <p><span className="font-semibold text-foreground">Minimum day.</span> One meaningful action is enough to protect momentum.</p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Choose your focus</h2>
                  <p className="text-xs text-muted-foreground mt-1">{selectedIds.length} of {PLAN_CAPACITY[energy]} slots filled</p>
                </div>
                <button type="button" onClick={refreshSuggestions} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Suggest
                </button>
              </div>

              {planningCandidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <Sparkles className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="font-bold">The board is clear.</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Add a habit or task to forge a focused plan.</p>
                  <Link href="/habits" className="inline-flex items-center gap-1 text-xs font-bold text-primary">Create one <ChevronRight className="h-3.5 w-3.5" /></Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {planningCandidates.map(habit => {
                    const selected = selectedIds.includes(habit.id)
                    return (
                      <button
                        key={habit.id}
                        onClick={() => toggleSelection(habit.id)}
                        className={cn(
                          'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                          selected ? 'border-primary/45 bg-primary/[0.08]' : 'border-border/70 bg-background/35 hover:border-border'
                        )}
                        aria-pressed={selected}
                      >
                        <span className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50')}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{habit.name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {habit.isTask ? `${habit.priority?.toUpperCase() ?? 'TASK'} · one-off` : `${habit.difficulty ?? 'medium'} · ${habit.estimatedMinutes ?? 'flex'} min`}
                          </span>
                        </span>
                        {habit.isKeystone && <span className="text-[9px] font-black uppercase tracking-wider text-primary">Keystone</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            {saved ? (
              <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Cancel</button>
            ) : <span className="text-xs text-muted-foreground">You can adjust this plan at any time.</span>}
            <button
              onClick={() => persistPlan(true)}
              disabled={saving || selectedIds.length === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
              Forge today&apos;s plan
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="daily-mission-title">
      <div className="p-5 sm:p-7 lg:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Flame className="h-4 w-4" />
              <span className="text-xs font-bold">Today&apos;s mission</span>
            </div>
            <h1 id="daily-mission-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {planComplete ? 'You kept the promise.' : intention || 'Protect the plan, not perfection.'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{formattedDate}</p>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 flex-none items-center gap-2 rounded-xl border border-border bg-secondary/35 px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:border-primary/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Adjust today's plan">
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Adjust</span>
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border/70 bg-background/35 py-3 lg:hidden">
          <div className="px-3">
            <p className="text-[11px] text-muted-foreground">Capacity</p>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><EnergyIcon className="h-4 w-4 text-primary" />{ENERGY_LABELS[energy].label}</div>
          </div>
          <div className="px-3">
            <p className="text-[11px] text-muted-foreground">Complete</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{completedCount}/{planItems.length}</p>
          </div>
          <div className="px-3">
            <p className="text-[11px] text-muted-foreground">Progress</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{progress}%</p>
          </div>
        </div>
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-secondary lg:hidden" role="progressbar" aria-label="Daily plan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:gap-8">
          <div className="space-y-2">
            {planItems.map((habit, index) => {
              const complete = isComplete(habit, today, timezone)
              const completions = getCompletionsForDate({ habit, date: today, timezone })
              const target = habit.targetCompletions ?? 1
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleCompletion(habit)}
                  disabled={completingId === habit.id}
                  className={cn(
                    'group flex min-h-[72px] w-full items-center gap-3 rounded-2xl border px-3 py-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:px-4',
                    complete
                      ? 'border-primary/15 bg-primary/[0.05] text-muted-foreground'
                      : 'border-border/80 bg-background/35 hover:border-primary/35 hover:bg-primary/[0.04]'
                  )}
                  aria-pressed={complete}
                >
                  <span className="hidden w-5 text-[11px] font-semibold tabular-nums text-muted-foreground/60 sm:block">{String(index + 1).padStart(2, '0')}</span>
                  <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors', complete ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/45 group-hover:border-primary/60')}>
                    {completingId === habit.id ? <Loader2 className="h-4 w-4 animate-spin" /> : complete ? <Check className="h-5 w-5" /> : <Circle className="h-3 w-3 opacity-30" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[15px] font-semibold', complete && 'line-through decoration-primary/60')}>{habit.name}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {habit.isTask
                        ? 'One-time task'
                        : `${habit.isKeystone ? 'Keystone · ' : ''}+${habit.attributeReward ?? getAttributeRewardForDifficulty(habit.difficulty)} ${ATTRIBUTE_LABELS[habit.primaryAttribute ?? getPrimaryAttributeForCategory(habit.category)]} XP · ${habit.estimatedMinutes ?? 'flex'} min`}
                    </span>
                    {habit.recommendationReason && <span className="mt-1 hidden truncate text-xs text-muted-foreground/70 sm:block">Why: {habit.recommendationReason}</span>}
                  </span>
                  {target > 1 && (
                    <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-black tabular-nums text-muted-foreground">{Math.min(completions, target)}/{target}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/45 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              )
            })}
          </div>

          <aside className={cn('flex flex-col rounded-2xl border border-border/80 bg-background/40 p-4 sm:p-5', !feedbackTarget && !adaptation && energy !== 'low' && !planComplete && 'hidden lg:flex')}>
            <div className="hidden items-center gap-4 lg:flex">
              <div
                className="h-20 w-20 rounded-full p-[5px] flex-shrink-0 transition-all duration-700"
                style={{ background: `conic-gradient(hsl(var(--primary)) ${progress * 3.6}deg, hsl(var(--secondary)) 0deg)` }}
              >
                <div className="h-full w-full rounded-full bg-card flex items-center justify-center">
                  <span className="text-lg font-black tabular-nums">{progress}%</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Plan progress</p>
                <p className="text-2xl font-black mt-1">{completedCount}<span className="text-muted-foreground">/{planItems.length}</span></p>
                <p className="text-xs text-muted-foreground mt-1">{planComplete ? 'Day secured' : `${planItems.length - completedCount} focus ${planItems.length - completedCount === 1 ? 'remains' : 'remain'}`}</p>
              </div>
            </div>

            {feedbackTarget && (
              <div className="lg:mt-5 lg:border-t lg:border-border/70 lg:pt-4">
                <p className="text-sm font-semibold">How did it feel?</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{feedbackTarget.name}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([
                    ['too_easy', 'Easy'],
                    ['right', 'Right'],
                    ['too_hard', 'Hard'],
                  ] as const).map(([value, label]) => (
                    <button type="button" key={value} onClick={() => recordEffort(feedbackTarget, value)} className="min-h-11 rounded-xl border border-border px-1 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{label}</button>
                  ))}
                </div>
              </div>
            )}

            {adaptation && (
              <div className="mt-5 border-t border-border/70 pt-4">
                <div className="flex items-center gap-2">
                  {adaptation.action === 'increase' ? <Sparkles className="h-4 w-4 text-primary" /> : <ShieldCheck className="h-4 w-4 text-cyan-300" />}
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Progression check</p>
                </div>
                <p className="mt-2 text-sm font-semibold">{adaptation.habitName}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{adaptation.reason}</p>
                <div className="mt-3 rounded-xl border border-border bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">{adaptation.currentDifficulty}</span>
                  {adaptation.currentMinutes != null && ` · ${adaptation.currentMinutes} min`}
                  <span className="mx-1.5">→</span>
                  <span className="font-bold text-primary">{adaptation.proposedDifficulty}</span>
                  {adaptation.proposedMinutes != null && ` · ${adaptation.proposedMinutes} min`}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={keepCurrentAdaptation} className="min-h-11 rounded-xl border border-border px-2 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Keep current</button>
                  <button type="button" onClick={applyAdaptation} disabled={adapting} className="min-h-11 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50">{adapting ? 'Applying…' : adaptation.action === 'increase' ? 'Progress once' : 'Use recovery'}</button>
                </div>
              </div>
            )}

            {energy === 'low' && !planComplete && (
              <div className="mt-5 flex items-start gap-2 border-t border-border/70 pt-4 text-sm leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <p><span className="font-semibold text-foreground">Minimum day.</span> This one win is enough to keep momentum alive.</p>
              </div>
            )}

            {planComplete && (
              <div className="mt-5 pt-5 border-t border-border/70 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Seal the day</p>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {MOODS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setMood(option.value)}
                      className={cn('min-h-11 rounded-xl border px-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', mood === option.value ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reflection}
                  onChange={event => setReflection(event.target.value.slice(0, 500))}
                  placeholder="What helped today?"
                  rows={3}
                  aria-label="Daily reflection"
                  className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 text-base leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => persistPlan(false)}
                  disabled={saving}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 text-sm font-semibold text-primary outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : reflection || mood ? <Save className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {reflection || mood ? 'Save reflection' : 'Seal without a note'}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  )
}
