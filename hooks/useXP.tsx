'use client'

import { useAtom, useAtomValue } from 'jotai'
import { xpAtom, currentLevelAtom, xpProgressAtom, levelUpAtom, habitStreaksAtom } from '@/lib/gamification-atoms'
import { addXP } from '@/app/actions/gamification'
import { calculateHabitXP, getLevelFromXP } from '@/lib/gamification'
import { Habit } from '@/lib/types'
import { currentUserAtom } from '@/lib/atoms'

export function useXP() {
  const [xpData, setXPData] = useAtom(xpAtom)
  const level = useAtomValue(currentLevelAtom)
  const progress = useAtomValue(xpProgressAtom)
  const [, setLevelUp] = useAtom(levelUpAtom)
  const currentUser = useAtomValue(currentUserAtom)
  const habitStreaks = useAtomValue(habitStreaksAtom)

  const addXPForHabit = async (habit: Habit) => {
    const baseXP = calculateHabitXP(habit)
    const streak = habitStreaks.get(habit.id) ?? 0
    const bonusXP = streak >= 7 ? Math.round(baseXP * 0.5) : 0
    const totalXP = baseXP + bonusXP

    const oldLevel = level
    const updated = await addXP({
      amount: totalXP,
      source: habit.isTask ? 'TASK_COMPLETION' : 'HABIT_COMPLETION',
      relatedItemId: habit.id,
      userId: currentUser?.id,
    })
    setXPData(updated)

    const newLevel = getLevelFromXP(updated.totalXP)
    if (newLevel > oldLevel) {
      setLevelUp(newLevel)
    }
  }

  const addXPForChallenge = async () => {
    const updated = await addXP({
      amount: 50,
      source: 'DAILY_CHALLENGE',
      userId: currentUser?.id,
    })
    setXPData(updated)
  }

  return { xpData, level, progress, addXPForHabit, addXPForChallenge }
}
