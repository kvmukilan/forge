import { useAtom, atom } from 'jotai'
import { useTranslations } from 'next-intl'
import { habitsAtom, coinsAtom, settingsAtom, usersAtom, habitFreqMapAtom, currentUserAtom } from '@/lib/atoms'
import { addCoins, saveHabitsData } from '@/app/actions/data'
import { addXP, damageBoss, addGems, claimStreakMilestone, addPerfectDay, saveXPData } from '@/app/actions/gamification'
import { completeHabitWithRewards, undoHabitWithRewards } from '@/app/actions/completion'
import { calculateStreak, getLevelFromXP, rollForGemDrop, getStreakMilestone } from '@/lib/gamification'
import { SKILL_NODES } from '@/lib/skill-trees'
import { xpAtom, levelUpAtom, bossAtom, hasGemBoostAtom, milestoneModalAtom, perfectDayModalAtom } from '@/lib/gamification-atoms'
import { Habit, Permission, SafeUser, User } from '@/lib/types'
import { toast } from '@/hooks/use-toast'
import { DateTime } from 'luxon'
import {
  getNowInMilliseconds,
  getTodayInTimezone,
  isSameDate,
  t2d,
  d2t,
  getNow,
  getCompletionsForDate,
  getISODate,
  d2s,
  playSound,
  checkPermission
} from '@/lib/utils'
import { ToastAction } from '@/components/ui/toast'
import { Undo2 } from 'lucide-react'
import { celebrate } from '@/lib/celebration'


function handlePermissionCheck(
  user: SafeUser | User | undefined,
  resource: 'habit' | 'wishlist' | 'coins',
  action: 'write' | 'interact',
  tCommon: (key: string, values?: Record<string, any>) => string
): boolean {
  if (!user) {
    toast({
      title: tCommon("authenticationRequiredTitle"),
      description: tCommon("authenticationRequiredDescription"),
      variant: "destructive",
    })
    return false
  }

  if (!user.isAdmin && !checkPermission(user.permissions, resource, action)) {
    toast({
      title: tCommon("permissionDeniedTitle"),
      description: tCommon("permissionDeniedDescription", { action, resource }),
      variant: "destructive",
    })
    return false
  }

  return true
}


export function useHabits() {
  const t = useTranslations('useHabits');
  const tCommon = useTranslations('Common');
  const [usersData] = useAtom(usersAtom)
  const [currentUser] = useAtom(currentUserAtom)
  const [habitsData, setHabitsData] = useAtom(habitsAtom)
  const [coins, setCoins] = useAtom(coinsAtom)
  const [settings] = useAtom(settingsAtom)
  const [habitFreqMap] = useAtom(habitFreqMapAtom)
  const [xpData, setXPData] = useAtom(xpAtom)
  const [, setLevelUp] = useAtom(levelUpAtom)
  const [, setBossData] = useAtom(bossAtom)
  const [hasGemBoost] = useAtom(hasGemBoostAtom)
  const [, setMilestone] = useAtom(milestoneModalAtom)
  const [, setPerfectDayModal] = useAtom(perfectDayModalAtom)

  const completeHabit = async (habit: Habit) => {
    if (!handlePermissionCheck(currentUser, 'habit', 'interact', tCommon)) return
    const timezone = settings.system.timezone
    const today = getTodayInTimezone(timezone)

    // Get current completions for today
    const completionsToday = getCompletionsForDate({
      habit,
      date: today,
      timezone
    })
    const target = habit.targetCompletions || 1

    // Check if already completed
    if (completionsToday >= target) {
      toast({
        title: t("alreadyCompletedTitle"),
        description: t("alreadyCompletedDescription"),
        variant: "destructive",
      })
      return
    }

    // Add new completion
    const newCompletionTimestamp = d2t({ dateTime: getNow({ timezone }) })
    const updatedHabit = {
      ...habit,
      completions: [...habit.completions, newCompletionTimestamp],
      // Archive the habit if it's a task and we're about to reach the target
      archived: habit.isTask && completionsToday + 1 === target ? true : habit.archived
    }

    const updatedHabits = habitsData.habits.map(h =>
      h.id === habit.id ? updatedHabit : h
    )

    const completionResult = await completeHabitWithRewards({ habitId: habit.id, completionAt: newCompletionTimestamp })
    if (!completionResult.inserted) return

    // Check if we've now reached the target
    const isTargetReached = completionsToday + 1 === target
    if (isTargetReached) {
      window.dispatchEvent(new Event('forge:progression-updated'))
      const coinAmount = completionResult.coinAmount
      const updatedCoins = completionResult.coins
      playSound()

      const oldLevel = getLevelFromXP(xpData.totalXP)
      const updatedXP = completionResult.xp

      // Update skill progress
      if (habit.category && !habit.isTask) {
        const latestXP = await import('@/app/actions/gamification').then(m => m.loadXPData())
        const currentProgress = (latestXP.skillProgress ?? {})[habit.category] ?? 0
        const newProgress = currentProgress + 1
        const categoryNodes = SKILL_NODES.filter(n => n.category === habit.category).sort((a, b) => a.tier - b.tier)
        const currentUnlocked = latestXP.unlockedSkills ?? []
        const newlyUnlocked = categoryNodes.filter(n =>
          !currentUnlocked.includes(n.id) && newProgress >= n.requiredCompletions
        )
        const updatedSkillXP = {
          ...latestXP,
          skillProgress: { ...(latestXP.skillProgress ?? {}), [habit.category!]: newProgress },
          unlockedSkills: [...currentUnlocked, ...newlyUnlocked.map(n => n.id)],
        }
        await saveXPData(updatedSkillXP)
        setXPData({ ...updatedXP, skillProgress: updatedSkillXP.skillProgress, unlockedSkills: updatedSkillXP.unlockedSkills })
        for (const node of newlyUnlocked) {
          toast({ title: `Skill Unlocked: ${node.name} ${node.emoji}`, description: `+${node.xpBonusPct}% XP on ${node.category} habits` })
        }
      } else {
        setXPData(updatedXP)
      }

      const newLevel = getLevelFromXP(updatedXP.totalXP)
      if (newLevel > oldLevel) setLevelUp(newLevel)

      // Boss damage
      const updatedBoss = await damageBoss(1)
      setBossData(updatedBoss)

      // Gem drop check
      if (rollForGemDrop(hasGemBoost)) {
        const withGem = await addGems(1)
        setXPData(withGem)
        toast({ title: 'Rare gem found', description: 'A gem dropped from your completed habit.' })
      }

      // Streak milestone check
      const newStreak = calculateStreak(updatedHabit, settings.system.timezone, xpData.shieldUsedDates)
      const milestone = getStreakMilestone(newStreak)
      if (milestone) {
        const milestoneXP = await claimStreakMilestone(habit.id, milestone.days, milestone.coins)
        if (milestoneXP) {
          setXPData(milestoneXP)
          setMilestone(milestone)
        }
      }

      // Keystone habit toast
      if (habit.isKeystone) {
        toast({ title: '⭐ Keystone complete!', description: '+25% XP bonus now active for the rest of today' })
      }

      // A brief confirmation, kept sparse so it never obscures the task list.
      celebrate('daily')

      setCoins(updatedCoins)
      toast({
        title: t("completedTitle"),
        description: t("earnedCoinsDescription", { coinReward: coinAmount }),
        action: <ToastAction altText={tCommon('undoButton')} className="gap-2" onClick={() => undoComplete(updatedHabit)}>
          <Undo2 className="h-4 w-4" />{tCommon('undoButton')}
        </ToastAction>
      })
    } else {
      toast({
        title: t("progressTitle"),
        description: t("progressDescription", { count: completionsToday + 1, target }),
        action: <ToastAction altText={tCommon('undoButton')} className="gap-2" onClick={() => undoComplete(updatedHabit)}>
          <Undo2 className="h-4 w-4" />{tCommon('undoButton')}
        </ToastAction>
      })
    }
    // move atom update at the end of function to improve UI responsiveness
    setHabitsData({ habits: updatedHabits })

    // Perfect day check — must happen after habit state update
    if (isTargetReached) {
      const timezone = settings.system.timezone
      const todayStr = DateTime.now().setZone(timezone).toISODate()!
      const allHabits = updatedHabits.filter(h => !h.isTask && !h.archived)
      const allDone = allHabits.length > 0 && allHabits.every(h => {
        const target = h.targetCompletions ?? 1
        return h.completions.filter(c => DateTime.fromISO(c).setZone(timezone).toISODate() === todayStr).length >= target
      })
      if (allDone) {
        const todayPerfect = (xpData.perfectDays ?? []).includes(todayStr)
        if (!todayPerfect) {
          const perfectXP = await addXP({ amount: 200, source: 'DAILY_CHALLENGE', relatedItemId: 'perfect-day' })
          const withPerfect = await addPerfectDay(todayStr)
          setXPData({ ...withPerfect, totalXP: perfectXP.totalXP, transactions: perfectXP.transactions })
          setPerfectDayModal(true)
        }
      }
    }

    return {
      updatedHabits,
      newCompletionTimestamp,
      newBalance: coins.balance,
      newTransactions: coins.transactions
    }
  }

  const undoComplete = async (habit: Habit) => {
    if (!handlePermissionCheck(currentUser, 'habit', 'interact', tCommon)) return
    const timezone = settings.system.timezone
    const today = t2d({ timestamp: getTodayInTimezone(timezone), timezone })

    // Get today's completions
    const todayCompletions = habit.completions.filter(completion =>
      isSameDate(t2d({ timestamp: completion, timezone }), today)
    )

    if (todayCompletions.length > 0) {
      const target = habit.targetCompletions || 1
      const removedCompletionTimestamp = todayCompletions[todayCompletions.length - 1]
      // Remove the most recent completion and unarchive if needed
      const updatedHabit = {
        ...habit,
        completions: habit.completions.filter(completion => completion !== removedCompletionTimestamp),
        archived: habit.isTask ? false : habit.archived // Unarchive if it's a task
      }

      const updatedHabits = habitsData.habits.map(h =>
        h.id === habit.id ? updatedHabit : h
      )

      const undoResult = await undoHabitWithRewards({ habitId: habit.id, completionAt: removedCompletionTimestamp })
      if (!undoResult.inserted) return
      setHabitsData({ habits: updatedHabits })

      // If we were at the target, remove the coins
      if (todayCompletions.length === target) {
        setCoins(undoResult.coins)
        setXPData(undoResult.xp)
        window.dispatchEvent(new Event('forge:progression-updated'))
      }

      toast({
        title: t("completionUndoneTitle"),
        description: t("completionUndoneDescription", {
          count: getCompletionsForDate({
            habit: updatedHabit,
            date: today,
            timezone
          }),
          target
        }),
        action: <ToastAction altText={tCommon('redoButton')} onClick={() => completeHabit(updatedHabit)}>
          <Undo2 className="h-4 w-4" />{tCommon('redoButton')}
        </ToastAction>
      })

      return {
        updatedHabits,
        newBalance: coins.balance,
        newTransactions: coins.transactions
      }
    } else {
      toast({
        title: t("noCompletionsToUndoTitle"),
        description: t("noCompletionsToUndoDescription"),
        variant: "destructive",
      })
      return
    }
  }

  const saveHabit = async (habit: Omit<Habit, 'id'> & { id?: string }) => {
    if (!handlePermissionCheck(currentUser, 'habit', 'write', tCommon)) return
    const newHabit = {
      ...habit,
      id: habit.id || getNowInMilliseconds().toString()
    }
    const updatedHabits = habit.id
      ? habitsData.habits.map(h => h.id === habit.id ? newHabit : h)
      : [...habitsData.habits, newHabit]

    await saveHabitsData({ habits: updatedHabits })
    setHabitsData({ habits: updatedHabits })
    return updatedHabits
  }

  const deleteHabit = async (id: string) => {
    if (!handlePermissionCheck(currentUser, 'habit', 'write', tCommon)) return
    const updatedHabits = habitsData.habits.filter(h => h.id !== id)
    await saveHabitsData({ habits: updatedHabits })
    setHabitsData({ habits: updatedHabits })
    return updatedHabits
  }

  const completePastHabit = async (habit: Habit, date: DateTime) => {
    if (!handlePermissionCheck(currentUser, 'habit', 'interact', tCommon)) return
    const timezone = settings.system.timezone
    const dateKey = getISODate({ dateTime: date, timezone })

    // Check if already completed on this date
    const completionsOnDate = habit.completions.filter(completion =>
      isSameDate(t2d({ timestamp: completion, timezone }), date)
    ).length
    const target = habit.targetCompletions || 1

    if (completionsOnDate >= target) {
      toast({
        title: t("alreadyCompletedPastDateTitle"),
        description: t("alreadyCompletedPastDateDescription", { dateKey: d2s({ dateTime: date, timezone, format: 'yyyy-MM-dd' }) }),
        variant: "destructive",
      })
      return
    }

    // Use current time but with the past date
    const now = getNow({ timezone })
    const completionDateTime = date.set({
      hour: now.hour,
      minute: now.minute,
      second: now.second,
      millisecond: now.millisecond
    })
    const completionTimestamp = d2t({ dateTime: completionDateTime })
    const updatedHabit = {
      ...habit,
      completions: [...habit.completions, completionTimestamp]
    }

    const updatedHabits = habitsData.habits.map(h =>
      h.id === habit.id ? updatedHabit : h
    )

    await saveHabitsData({ habits: updatedHabits })
    setHabitsData({ habits: updatedHabits })

    // Check if we've now reached the target
    const isTargetReached = completionsOnDate + 1 === target
    if (isTargetReached) {
      const updatedCoins = await addCoins({
        amount: habit.coinReward,
        description: `Completed: ${habit.name} on ${d2s({ dateTime: date, timezone, format: 'yyyy-MM-dd' })}`,
        type: habit.isTask ? 'TASK_COMPLETION' : 'HABIT_COMPLETION',
        relatedItemId: habit.id,
        eventKey: `completion:${habit.id}:${completionTimestamp}:coins`,
      })
      setCoins(updatedCoins)
    }

    toast({
      title: isTargetReached ? t("completedTitle") : t("progressTitle"),
      description: isTargetReached
        ? t("earnedCoinsPastDateDescription", { coinReward: habit.coinReward, dateKey })
        : t("progressPastDateDescription", { count: completionsOnDate + 1, target, dateKey }),
      action: <ToastAction altText={tCommon('undoButton')} className="gap-2" onClick={() => undoComplete(updatedHabit)}>
        <Undo2 className="h-4 w-4" />{tCommon('undoButton')}
      </ToastAction>
    })

    return {
      updatedHabits,
      newBalance: coins.balance,
      newTransactions: coins.transactions
    }
  }

  const archiveHabit = async (id: string) => {
    if (!handlePermissionCheck(currentUser, 'habit', 'write', tCommon)) return
    const updatedHabits = habitsData.habits.map(h =>
      h.id === id ? { ...h, archived: true } : h
    )
    await saveHabitsData({ habits: updatedHabits })
    setHabitsData({ habits: updatedHabits })
  }

  const unarchiveHabit = async (id: string) => {
    if (!handlePermissionCheck(currentUser, 'habit', 'write', tCommon)) return
    const updatedHabits = habitsData.habits.map(h =>
      h.id === id ? { ...h, archived: false } : h
    )
    await saveHabitsData({ habits: updatedHabits })
    setHabitsData({ habits: updatedHabits })
  }

  return {
    completeHabit,
    undoComplete,
    saveHabit,
    deleteHabit,
    completePastHabit,
    archiveHabit,
    unarchiveHabit,
    habitFreqMap,
  }
}
