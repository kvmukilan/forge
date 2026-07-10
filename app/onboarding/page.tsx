'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAtomValue } from 'jotai'
import confetti from 'canvas-confetti'
import { habitsAtom } from '@/lib/atoms'
import { useHabits } from '@/hooks/useHabits'
import { HABIT_TEMPLATES } from '@/lib/habit-templates'
import { INITIAL_RECURRENCE_RULE } from '@/lib/constants'
import type { Habit } from '@/lib/types'
import { Check, ChevronRight, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_PICKS = 3

export default function OnboardingPage() {
  const router = useRouter()
  const { saveHabit, completeHabit } = useHabits()
  const habitsData = useAtomValue(habitsAtom)

  const [step, setStep] = useState<'pick' | 'log' | 'done'>('pick')
  const [picked, setPicked] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [createdIds, setCreatedIds] = useState<string[]>([])
  const [loggedFirst, setLoggedFirst] = useState(false)

  const createdHabits = useMemo(
    () => habitsData.habits.filter(h => createdIds.includes(h.id)),
    [habitsData.habits, createdIds]
  )

  const togglePick = (id: string) => {
    setPicked(prev =>
      prev.includes(id) ? prev.filter(p => p !== id)
        : prev.length >= MAX_PICKS ? prev
          : [...prev, id]
    )
  }

  const finish = () => {
    try { localStorage.setItem('forge-onboarded', '1') } catch {}
    router.push('/')
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      let habits: Habit[] | undefined
      for (const templateId of picked) {
        const template = HABIT_TEMPLATES.find(t => t.id === templateId)!
        habits = await saveHabit({
          name: template.name,
          description: template.description,
          frequency: INITIAL_RECURRENCE_RULE,
          coinReward: template.coinReward,
          completions: [],
          category: template.category,
          difficulty: template.difficulty,
          // The first pick becomes the keystone habit
          isKeystone: templateId === picked[0],
        })
      }
      const created = (habits ?? []).slice(-picked.length).map(h => h.id)
      setCreatedIds(created)
      setStep('log')
    } finally {
      setCreating(false)
    }
  }

  const handleFirstLog = async (habit: Habit) => {
    await completeHabit(habit)
    setLoggedFirst(true)
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } })
    setTimeout(() => setStep('done'), 900)
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        {step === 'pick' && (
          <>
            <div className="text-center space-y-2">
              <p className="section-label">Step 1 of 2</p>
              <h1 className="text-2xl font-black">Who do you want to become?</h1>
              <p className="text-sm text-muted-foreground">
                Pick up to three habits. The first becomes your keystone — the one that anchors the rest.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HABIT_TEMPLATES.map(template => {
                const isPicked = picked.includes(template.id)
                const pickIndex = picked.indexOf(template.id)
                return (
                  <button
                    key={template.id}
                    onClick={() => togglePick(template.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      isPicked
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary/40 hover:bg-secondary/70'
                    )}
                  >
                    <span className="text-xl flex-shrink-0" aria-hidden>{template.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold truncate">{template.name}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        …someone who {template.identity}
                      </span>
                    </span>
                    {isPicked && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black flex-shrink-0">
                        {pickIndex === 0 ? <Flame className="h-3 w-3" /> : pickIndex + 1}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Skip for now
              </button>
              <button
                onClick={handleCreate}
                disabled={picked.length === 0 || creating}
                className={cn(
                  'flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors',
                  'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {creating ? 'Creating…' : `Forge ${picked.length || ''} habit${picked.length === 1 ? '' : 's'}`}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {step === 'log' && (
          <>
            <div className="text-center space-y-2">
              <p className="section-label">Step 2 of 2</p>
              <h1 className="text-2xl font-black">Log your first win — right now</h1>
              <p className="text-sm text-muted-foreground">
                Done is better than perfect. Pick one you can honestly check off today.
              </p>
            </div>

            <div className="space-y-2">
              {createdHabits.map(habit => (
                <button
                  key={habit.id}
                  onClick={() => handleFirstLog(habit)}
                  disabled={loggedFirst}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-left',
                    'hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-60'
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary/50 flex-shrink-0">
                    <Check className="h-4 w-4 text-primary" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{habit.name}</span>
                    <span className="block text-[11px] text-muted-foreground">+{habit.coinReward} coins</span>
                  </span>
                  {habit.isKeystone && (
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wide flex-shrink-0">Keystone</span>
                  )}
                </button>
              ))}
            </div>

            <div className="text-center">
              <button onClick={() => setStep('done')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                I&apos;ll log later today
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="text-center space-y-5">
            <div className="text-5xl" aria-hidden>🔥</div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black">{loggedFirst ? 'Day 1 is in the books' : 'Your forge is lit'}</h1>
              <p className="text-sm text-muted-foreground">
                Come back tomorrow to keep the streak alive. Daily quests and login rewards are waiting.
              </p>
            </div>
            <button
              onClick={finish}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Enter the Forge
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
