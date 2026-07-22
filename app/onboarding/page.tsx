'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Clock3,
  Crosshair,
  Dumbbell,
  HeartPulse,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import {
  ATTRIBUTE_DESCRIPTIONS,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  DEFAULT_ATTRIBUTE_SCORES,
  assessStartingAttributes,
  generateStarterProgram,
  getAttributeRewardForDifficulty,
  type AssessmentResponses,
  type AttributeKey,
  type AttributeScores,
  type ProgramRecommendation,
} from '@/lib/progression'
import { finalizeOnboarding, getProgressionSummary } from '@/app/actions/progression'
import { cn } from '@/lib/utils'

const ATTRIBUTE_ICONS = {
  strength: Dumbbell,
  vitality: HeartPulse,
  focus: Crosshair,
  wisdom: BookOpen,
  discipline: ShieldCheck,
  connection: Users,
} satisfies Record<AttributeKey, typeof Dumbbell>

const DEFAULT_RESPONSES: AssessmentResponses = {
  focusAreas: ['discipline', 'vitality', 'focus'],
  baselines: { ...DEFAULT_ATTRIBUTE_SCORES },
  consistency: 3,
  energy: 3,
  weekdayMinutes: 30,
  weekendMinutes: 45,
  preferredTime: 'flexible',
  pace: 'balanced',
  motivation: 'visible_progress',
  restDays: [0],
  constraints: '',
}

const STEP_LABELS = ['Direction', 'Baseline', 'Capacity', 'Approach', 'Review']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function OptionButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-11 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [responses, setResponses] = useState<AssessmentResponses>(DEFAULT_RESPONSES)
  const [editedAttributes, setEditedAttributes] = useState<AttributeScores>({ ...DEFAULT_ATTRIBUTE_SCORES })
  const [recommendations, setRecommendations] = useState<ProgramRecommendation[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingExisting, setLoadingExisting] = useState(true)

  const assessment = useMemo(() => assessStartingAttributes(responses), [responses])

  useEffect(() => {
    getProgressionSummary()
      .then(summary => {
        const existing = summary?.profile.responses
        if (existing?.baselines) {
          setResponses({ ...DEFAULT_RESPONSES, ...existing, baselines: { ...DEFAULT_ATTRIBUTE_SCORES, ...existing.baselines } })
          setEditedAttributes(summary!.profile.baseAttributes)
        }
      })
      .finally(() => setLoadingExisting(false))
  }, [])

  const toggleFocus = (key: AttributeKey) => {
    setResponses(current => {
      const selected = current.focusAreas.includes(key)
      if (selected && current.focusAreas.length === 1) return current
      if (!selected && current.focusAreas.length >= 3) return current
      return {
        ...current,
        focusAreas: selected ? current.focusAreas.filter(item => item !== key) : [...current.focusAreas, key],
      }
    })
  }

  const setBaseline = (key: AttributeKey, value: number) => {
    setResponses(current => ({ ...current, baselines: { ...current.baselines, [key]: value } }))
  }

  const toggleRestDay = (day: number) => {
    setResponses(current => ({
      ...current,
      restDays: current.restDays.includes(day)
        ? current.restDays.filter(item => item !== day)
        : [...current.restDays, day].sort(),
    }))
  }

  const goNext = () => {
    setError('')
    if (step === 3) {
      setEditedAttributes(assessment.attributes)
      setRecommendations(generateStarterProgram(responses))
    }
    setStep(current => Math.min(4, current + 1))
  }

  const updateRecommendation = (index: number, patch: Partial<ProgramRecommendation>) => {
    setRecommendations(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  const swapRecommendation = (index: number) => {
    const used = new Set(recommendations.map(item => item.primaryAttribute))
    const currentKey = recommendations[index].primaryAttribute
    const currentIndex = ATTRIBUTE_KEYS.indexOf(currentKey)
    const replacementKey = ATTRIBUTE_KEYS.find(key => !used.has(key))
      ?? ATTRIBUTE_KEYS[(currentIndex + 1) % ATTRIBUTE_KEYS.length]
    const replacement = generateStarterProgram({ ...responses, focusAreas: [replacementKey] })[0]
    setRecommendations(current => current.map((item, itemIndex) => itemIndex === index ? replacement : item))
  }

  const addCustomRecommendation = () => {
    if (recommendations.length >= 5) return
    setRecommendations(current => [...current, {
      id: `custom-${Date.now()}`,
      name: 'My custom quest',
      description: 'Define the smallest clear action that counts as complete.',
      frequency: 'FREQ=DAILY',
      difficulty: 'easy',
      category: 'other',
      primaryAttribute: 'discipline',
      secondaryAttribute: null,
      estimatedMinutes: 10,
      coinReward: 5,
      attributeReward: 10,
      reason: 'A quest you chose for yourself.',
    }])
  }

  const finish = async () => {
    if (recommendations.length === 0) {
      setError('Choose at least one quest to begin your campaign.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const activated = await finalizeOnboarding({ responses, attributes: editedAttributes, recommendations })
      try { localStorage.setItem('forge-onboarded', '1') } catch {}
      // The action reads the persisted quests back before returning. A unique
      // document URL then bypasses any pre-onboarding PWA/navigation cache.
      window.location.replace(`/?activated=${Date.now()}&quests=${activated.habits.habits.length}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assessment could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingExisting) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="sr-only">Loading assessment</span>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in">
      <div className="mb-7 border-b border-border pb-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-sm font-black text-background">F</span>
            <div>
              <p className="text-sm font-black tracking-[0.08em]">FORGE</p>
              <p className="text-xs text-muted-foreground">Personal setup</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Step {step + 1} of {STEP_LABELS.length}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5" aria-label={`Step ${step + 1}: ${STEP_LABELS[step]}`}>
          {STEP_LABELS.map((label, index) => (
            <div key={label}>
              <div className={cn('h-1 rounded-full transition-colors', index <= step ? 'bg-primary' : 'bg-secondary')} />
              <span className={cn('mt-1.5 hidden text-[9px] font-bold uppercase tracking-wider sm:block', index === step ? 'text-foreground' : 'text-muted-foreground/60')}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="bg-transparent p-0 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-8">
        {step === 0 && (
          <div>
            <p className="section-label mb-2">Choose up to three</p>
            <h1 className="text-3xl font-black tracking-tight">What are you ready to develop?</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">This sets the direction of your first program. It does not label what you are capable of becoming.</p>
            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              {ATTRIBUTE_KEYS.map(key => {
                const Icon = ATTRIBUTE_ICONS[key]
                const active = responses.focusAreas.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFocus(key)}
                    aria-pressed={active}
                    className={cn(
                      'min-h-28 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                      active ? 'border-primary bg-primary/[0.07]' : 'border-border bg-background hover:border-muted-foreground/60',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', active ? 'border-primary text-primary' : 'border-border text-muted-foreground')}><Icon className="h-4 w-4" /></span>
                      <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{active && <Check className="h-3 w-3" />}</span>
                    </div>
                    <h2 className="mt-4 font-black">{ATTRIBUTE_LABELS[key]}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ATTRIBUTE_DESCRIPTIONS[key]}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="section-label mb-2">Self-reported baseline</p>
            <h1 className="text-3xl font-black tracking-tight">Where are your routines today?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Rate recent behavior, not talent or worth. You can edit the calculated result before saving it.</p>
            <div className="mt-7 space-y-3">
              {ATTRIBUTE_KEYS.map(key => {
                const Icon = ATTRIBUTE_ICONS[key]
                return (
                  <div key={key} className="grid gap-3 rounded-xl border border-border bg-background/25 p-3 sm:grid-cols-[11rem_1fr] sm:items-center">
                    <div className="flex items-center gap-2.5"><Icon className="h-4 w-4 text-primary" /><span className="text-sm font-bold">{ATTRIBUTE_LABELS[key]}</span></div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map(value => <OptionButton key={value} active={responses.baselines[key] === value} onClick={() => setBaseline(key, value)}>{value}</OptionButton>)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="rounded-xl border border-border bg-background/25 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent follow-through: {responses.consistency}/5</span>
                <input className="mt-4 w-full accent-primary" type="range" min="1" max="5" value={responses.consistency} onChange={event => setResponses(current => ({ ...current, consistency: Number(event.target.value) }))} />
              </label>
              <label className="rounded-xl border border-border bg-background/25 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Typical energy: {responses.energy}/5</span>
                <input className="mt-4 w-full accent-primary" type="range" min="1" max="5" value={responses.energy} onChange={event => setResponses(current => ({ ...current, energy: Number(event.target.value) }))} />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="section-label mb-2">Design for real life</p>
            <h1 className="text-3xl font-black tracking-tight">What capacity can you protect?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Forge will scale the plan to your available time and preserve scheduled recovery.</p>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              {([['weekdayMinutes', 'Weekday capacity'], ['weekendMinutes', 'Weekend capacity']] as const).map(([field, label]) => (
                <div key={field}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 20, 30, 45, 60, 90].map(value => <OptionButton key={value} active={responses[field] === value} onClick={() => setResponses(current => ({ ...current, [field]: value }))}>{value} min</OptionButton>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Preferred time</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {(['morning', 'afternoon', 'evening', 'flexible'] as const).map(value => <OptionButton key={value} active={responses.preferredTime === value} onClick={() => setResponses(current => ({ ...current, preferredTime: value }))}><Clock3 className="mr-1.5 inline h-3.5 w-3.5" />{value[0].toUpperCase() + value.slice(1)}</OptionButton>)}
              </div>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Protected rest days</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LABELS.map((label, day) => <OptionButton key={label} active={responses.restDays.includes(day)} onClick={() => toggleRestDay(day)}>{label}</OptionButton>)}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="section-label mb-2">Choose the pressure</p>
            <h1 className="text-3xl font-black tracking-tight">How should progress feel?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Difficulty is a starting preference, not a permanent contract.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {([
                ['gentle', 'Gentle', 'Minimum viable wins and generous recovery.'],
                ['balanced', 'Balanced', 'A useful challenge with room for imperfect days.'],
                ['challenging', 'Challenging', 'Higher initial effort with the same recovery safeguards.'],
              ] as const).map(([value, label, description]) => (
                <button key={value} type="button" onClick={() => setResponses(current => ({ ...current, pace: value }))} aria-pressed={responses.pace === value} className={cn('min-h-32 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', responses.pace === value ? 'border-primary bg-primary/[0.07]' : 'border-border bg-background hover:border-muted-foreground/60')}>
                  <span className="font-black">{label}</span><span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{description}</span>
                </button>
              ))}
            </div>
            <div className="mt-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">What keeps you returning?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['visible_progress', 'Seeing measurable growth'], ['rewards', 'Unlocking meaningful rewards'],
                  ['structure', 'Knowing exactly what to do'], ['accountability', 'Keeping a promise to others'],
                ] as const).map(([value, label]) => <OptionButton key={value} active={responses.motivation === value} onClick={() => setResponses(current => ({ ...current, motivation: value }))}>{label}</OptionButton>)}
              </div>
            </div>
            <label className="mt-7 block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Constraints or accessibility needs <span className="normal-case tracking-normal">(optional and private)</span></span>
              <textarea value={responses.constraints} onChange={event => setResponses(current => ({ ...current, constraints: event.target.value.slice(0, 500) }))} rows={4} placeholder="For example: protect an injury, no mornings, variable shifts, or keep every action seated." className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/45 focus:border-primary focus:ring-1 focus:ring-ring" />
            </label>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="section-label mb-2">Your editable starting point</p><h1 className="text-3xl font-black tracking-tight">Your starting profile</h1></div>
              <span className="text-xs font-semibold text-muted-foreground">Self-report · not a diagnosis</span>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ATTRIBUTE_KEYS.map(key => {
                const Icon = ATTRIBUTE_ICONS[key]
                return (
                  <div key={key} className="rounded-2xl border border-border bg-background/35 p-4">
                    <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-black"><Icon className="h-4 w-4 text-primary" />{ATTRIBUTE_LABELS[key]}</span><span className="text-2xl font-black text-foreground">{editedAttributes[key]}</span></div>
                    <input aria-label={`${ATTRIBUTE_LABELS[key]} starting value`} className="mt-4 w-full accent-primary" type="range" min="1" max="10" value={editedAttributes[key]} onChange={event => setEditedAttributes(current => ({ ...current, [key]: Number(event.target.value) }))} />
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{assessment.explanations[key].join(' ')}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-9 flex items-end justify-between gap-4">
              <div><p className="section-label mb-1">Proposed program</p><h2 className="text-xl font-black">Edit everything before activation.</h2></div>
              <button type="button" onClick={addCustomRecommendation} disabled={recommendations.length >= 5} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground disabled:opacity-40"><Plus className="h-3.5 w-3.5" />Add my own</button>
            </div>
            <div className="mt-4 space-y-3">
              {recommendations.map((item, index) => (
                <article key={item.id} className="rounded-2xl border border-border bg-background/35 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border text-xs font-black text-muted-foreground">0{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <input aria-label={`Quest ${index + 1} name`} value={item.name} onChange={event => updateRecommendation(index, { name: event.target.value.slice(0, 120) })} className="w-full bg-transparent text-base font-black outline-none focus:text-primary" />
                      <textarea aria-label={`Quest ${index + 1} description`} value={item.description} onChange={event => updateRecommendation(index, { description: event.target.value.slice(0, 500) })} rows={2} className="mt-1 w-full resize-none bg-transparent text-xs leading-relaxed text-muted-foreground outline-none" />
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <select aria-label={`Quest ${index + 1} schedule`} value={item.frequency} onChange={event => updateRecommendation(index, { frequency: event.target.value })} className="rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs font-bold outline-none">
                            <option value="FREQ=DAILY">Daily</option>
                            <option value="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">Weekdays</option>
                            <option value="FREQ=WEEKLY;BYDAY=MO,WE,FR">Mon / Wed / Fri</option>
                            <option value="FREQ=WEEKLY;BYDAY=SA,SU">Weekends</option>
                          </select>
                          <select value={item.difficulty} onChange={event => {
                          const difficulty = event.target.value as ProgramRecommendation['difficulty']
                          updateRecommendation(index, {
                            difficulty,
                            attributeReward: getAttributeRewardForDifficulty(difficulty),
                            coinReward: difficulty === 'hard' ? 15 : difficulty === 'medium' ? 10 : 5,
                          })
                        }} className="rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs font-bold outline-none"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
                        <label className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs font-bold"><input className="w-10 bg-transparent text-right outline-none" type="number" min="1" max="240" value={item.estimatedMinutes} onChange={event => updateRecommendation(index, { estimatedMinutes: Math.max(1, Math.min(240, Number(event.target.value))) })} /> min</label>
                        <span className="rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs font-bold text-primary">+{item.attributeReward} {ATTRIBUTE_LABELS[item.primaryAttribute]} XP</span>
                      </div>
                      <p className="mt-3 text-[11px] text-muted-foreground"><Brain className="mr-1 inline h-3 w-3 text-primary" />{item.reason}</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => swapRecommendation(index)} title="Replace recommendation" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><RefreshCw className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setRecommendations(current => current.filter((_, itemIndex) => itemIndex !== index))} title="Remove recommendation" className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>}

        <div className="mt-8 flex items-center justify-between border-t border-border/70 pt-5">
          <button type="button" onClick={() => setStep(current => Math.max(0, current - 1))} disabled={step === 0 || saving} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-0"><ArrowLeft className="h-4 w-4" />Back</button>
          {step < 4 ? (
            <button type="button" onClick={goNext} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-black text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">Continue <ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button type="button" onClick={finish} disabled={saving || recommendations.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-black text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Activate program</button>
          )}
        </div>
      </section>
    </div>
  )
}
