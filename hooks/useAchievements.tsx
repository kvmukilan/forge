'use client'

import { useAtom, useAtomValue } from 'jotai'
import { xpAtom, currentLevelAtom, maxStreakAtom } from '@/lib/gamification-atoms'
import { habitsAtom, coinsAtom } from '@/lib/atoms'
import { ACHIEVEMENT_DEFINITIONS, AchievementCheckData } from '@/lib/gamification'
import { unlockAchievement } from '@/app/actions/gamification'
import { useEffect, useRef } from 'react'
import { toast } from '@/hooks/use-toast'

export function useAchievements() {
  const [xpData, setXPData] = useAtom(xpAtom)
  const level = useAtomValue(currentLevelAtom)
  const maxStreak = useAtomValue(maxStreakAtom)
  const [habitsData] = useAtom(habitsAtom)
  const [coinsData] = useAtom(coinsAtom)
  const checkedRef = useRef(false)

  const totalEarned = coinsData.transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const hasRedeemedWishlist = coinsData.transactions.some(t => t.type === 'WISH_REDEMPTION')

  const checkData: AchievementCheckData = {
    habits: habitsData.habits,
    maxStreak,
    level,
    totalEarned,
    hasRedeemedWishlist,
  }

  const allAchievements = ACHIEVEMENT_DEFINITIONS.map(def => ({
    ...def,
    isUnlocked: def.check(checkData),
    unlockedAt: xpData.unlockedAchievements.find(a => a.id === def.id)?.unlockedAt,
  }))

  const unlockedAchievements = allAchievements.filter(a => a.isUnlocked)

  // Check for newly unlocked on mount and when data changes
  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    const checkNewAchievements = async () => {
      let currentXP = xpData
      for (const def of ACHIEVEMENT_DEFINITIONS) {
        const alreadyUnlocked = currentXP.unlockedAchievements.some(a => a.id === def.id)
        if (!alreadyUnlocked && def.check(checkData)) {
          currentXP = await unlockAchievement(def.id, currentXP)
          toast({
            title: `Achievement Unlocked!`,
            description: `${def.name} — ${def.description}`,
          })
        }
      }
      if (currentXP !== xpData) {
        setXPData(currentXP)
      }
    }

    checkNewAchievements()
  })

  return { allAchievements, unlockedAchievements }
}
