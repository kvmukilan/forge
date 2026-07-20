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

  if (loading) {
    return (
      <div className="min-h-64 rounded-[1.75rem] border border-border/80 bg-card/70 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="sr-only">Loading today&apos;s plan</span>
      </div>
    )
  }

  if (editing) {
    return (
      <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_36%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] shadow-[0_24px_80px_-42px_hsl(var(--primary)/0.65)]">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
        <div className="p-5 sm:p-7 lg:p-8 space-y-7">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary mb-2">
                <Flame className="h-4 w-4" />
                <span className="text-[11px] font-black uppercase tracking-[0.24em]">Daily Forge</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Build a day you can finish.</h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">Set your capacity, choose what matters, and let everything else wait.</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{formattedDate}</span>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground mb-3">How much do you have today?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(ENERGY_LABELS) as EnergyLevel[]).map(level => {
                const Icon = ENERGY_ICONS[level]
                const active = energy === level
                return (
                  <button
                    key={level}
                    onClick={() => updateEnergy(level)}
                    className={cn(
                      'group text-left rounded-2xl border p-4 transition-all duration-200',
                      active
                        ? 'border-primary/60 bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]'
                        : 'border-border/80 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/40'
                    )}
                    aria-pressed={active}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-[10px] font-black uppercase tracking-[0.14em]', active ? 'text-primary' : 'text-muted-foreground')}>
                        {PLAN_CAPACITY[level]} slot{PLAN_CAPACITY[level] === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="font-bold">{ENERGY_LABELS[level].label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ENERGY_LABELS[level].description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-6 lg:gap-8">
            <div className="space-y-3">
              <label htmlFor="daily-intention" className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Today counts if I…</label>
              <textarea
                id="daily-intention"
                value={intention}
                onChange={event => setIntention(event.target.value.slice(0, 160))}
                placeholder="Protect my focus and finish what matters."
                rows={4}
                className="w-full resize-none rounded-2xl border border-border bg-background/55 px-4 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              />
              {energy === 'low' && (
                <div className="flex gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                  <p><span className="font-bold text-foreground">Minimum day.</span> One meaningful action protects momentum without pretending every day has equal capacity.</p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Choose your focus</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedIds.length} of {PLAN_CAPACITY[energy]} slots filled</p>
                </div>
                <button onClick={refreshSuggestions} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
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
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {planningCandidates.map(habit => {
                    const selected = selectedIds.includes(habit.id)
                    return (
                      <button
                        key={habit.id}
                        onClick={() => toggleSelection(habit.id)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all',
                          selected ? 'border-primary/45 bg-primary/[0.08]' : 'border-border/70 bg-background/35 hover:border-border'
                        )}
                        aria-pressed={selected}
                      >
                        <span className={cn('h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50')}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold truncate">{habit.name}</span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {habit.isTask ? `${habit.priority?.toUpperCase() ?? 'TASK'} · one-off` : `${habit.difficulty ?? 'medium'} quest · ${habit.estimatedMinutes ?? 'flex'} min`}
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
              <button onClick={() => setEditing(false)} className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            ) : <span className="text-xs text-muted-foreground">You can adjust this plan at any time.</span>}
            <button
              onClick={() => persistPlan(true)}
              disabled={saving || selectedIds.length === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground shadow-[0_8px_28px_-10px_hsl(var(--primary))] transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:translate-y-0 disabled:opacity-45"
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
    <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-[radial-gradient(circle_at_92%_8%,hsl(var(--primary)/0.16),transparent_32%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))] shadow-[0_24px_80px_-42px_hsl(var(--primary)/0.65)]">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
      <div className="p-5 sm:p-7 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
          <div>
            <div className="flex items-center gap-2 text-primary mb-2">
              <Flame className="h-4 w-4" />
              <span className="text-[11px] font-black uppercase tracking-[0.24em]">Today&apos;s mission</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {planComplete ? 'You kept the promise.' : intention || 'Protect the plan, not perfection.'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">{formattedDate} · {ENERGY_LABELS[energy].label} capacity</p>
          </div>
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-secondary/35 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
            Adjust plan
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_18rem] gap-7 lg:gap-10">
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
                    'group w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all',
                    complete
                      ? 'border-primary/15 bg-primary/[0.05] text-muted-foreground'
                      : 'border-border/80 bg-background/35 hover:border-primary/35 hover:bg-primary/[0.04]'
                  )}
                  aria-pressed={complete}
                >
                  <span className="w-5 text-[10px] font-black tabular-nums text-muted-foreground/65">0{index + 1}</span>
                  <span className={cn('h-6 w-6 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors', complete ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/45 group-hover:border-primary/60')}>
                    {completingId === habit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : complete ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3 opacity-0" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm font-bold truncate', complete && 'line-through decoration-primary/60')}>{habit.name}</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      {habit.isTask
                        ? 'One-time task'
                        : `${habit.isKeystone ? 'Keystone · ' : ''}+${habit.attributeReward ?? getAttributeRewardForDifficulty(habit.difficulty)} ${ATTRIBUTE_LABELS[habit.primaryAttribute ?? getPrimaryAttributeForCategory(habit.category)]} XP · ${habit.estimatedMinutes ?? 'flex'} min`}
                    </span>
                    {habit.recommendationReason && <span className="mt-1 block truncate text-[10px] text-muted-foreground/70">Why: {habit.recommendationReason}</span>}
                  </span>
                  {target > 1 && (
                    <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-black tabular-nums text-muted-foreground">{Math.min(completions, target)}/{target}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/45 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              )
            })}
          </div>

          <aside className="rounded-2xl border border-border/80 bg-background/40 p-5 flex flex-col">
            <div className="flex items-center gap-4">
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
              <div className="mt-5 border-t border-border/70 pt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">How did it feel?</p>
                <p className="mt-1 truncate text-xs font-bold">{feedbackTarget.name}</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {([
                    ['too_easy', 'Easy'],
                    ['right', 'Right'],
                    ['too_hard', 'Hard'],
                  ] as const).map(([value, label]) => (
                    <button key={value} onClick={() => recordEffort(feedbackTarget, value)} className="rounded-lg border border-border px-1 py-2 text-[10px] font-bold text-muted-foreground hover:border-violet-400/40 hover:text-violet-200">{label}</button>
                  ))}
                </div>
              </div>
            )}

            {adaptation && (
              <div className="mt-5 border-t border-border/70 pt-4">
                <div className="flex items-center gap-2">
                  {adaptation.action === 'increase' ? <Sparkles className="h-4 w-4 text-violet-300" /> : <ShieldCheck className="h-4 w-4 text-cyan-300" />}
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Progression check</p>
                </div>
                <p className="mt-2 text-xs font-bold">{adaptation.habitName}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{adaptation.reason}</p>
                <div className="mt-3 rounded-lg border border-border bg-secondary/35 px-3 py-2 text-[10px] text-muted-foreground">
                  <span className="font-bold text-foreground">{adaptation.currentDifficulty}</span>
                  {adaptation.currentMinutes != null && ` · ${adaptation.currentMinutes} min`}
                  <span className="mx-1.5">→</span>
                  <span className="font-bold text-violet-200">{adaptation.proposedDifficulty}</span>
                  {adaptation.proposedMinutes != null && ` · ${adaptation.proposedMinutes} min`}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={keepCurrentAdaptation} className="rounded-lg border border-border px-2 py-2 text-[10px] font-bold text-muted-foreground hover:text-foreground">Keep current</button>
                  <button onClick={applyAdaptation} disabled={adapting} className="rounded-lg bg-violet-500 px-2 py-2 text-[10px] font-black text-white hover:bg-violet-400 disabled:opacity-50">{adapting ? 'Applying…' : adaptation.action === 'increase' ? 'Progress once' : 'Use recovery'}</button>
                </div>
              </div>
            )}

            {energy === 'low' && !planComplete && (
              <div className="mt-5 pt-4 border-t border-border/70 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
                <p>Minimum day: this one win is enough to keep momentum alive.</p>
              </div>
            )}

            {planComplete && (
              <div className="mt-5 pt-5 border-t border-border/70 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-xs font-black uppercase tracking-[0.14em]">Seal the day</p>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {MOODS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setMood(option.value)}
                      className={cn('rounded-lg border px-1 py-2 text-[10px] font-bold transition-colors', mood === option.value ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
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
                  className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 text-xs leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
                />
                <button
                  onClick={() => persistPlan(false)}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-primary/35 bg-primary/10 py-2 text-xs font-black text-primary hover:bg-primary/15 transition-colors disabled:opacity-50"
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
