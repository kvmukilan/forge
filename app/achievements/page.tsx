'use client'

import { useAchievements } from '@/hooks/useAchievements'
import AchievementBadge from '@/components/AchievementBadge'
import { Trophy, Crown } from 'lucide-react'
import { useAtom, useAtomValue } from 'jotai'
import { xpAtom, maxStreakAtom, shieldsAtom, perfectDayStreakAtom, gemsAtom } from '@/lib/gamification-atoms'
import { coinsAtom } from '@/lib/atoms'
import { TITLE_DEFINITIONS, TitleCheckData } from '@/lib/gamification'
import { saveXPData } from '@/app/actions/gamification'
import { toast } from '@/hooks/use-toast'

export default function AchievementsPage() {
  const { allAchievements, unlockedAchievements } = useAchievements()
  const [xpData, setXPData] = useAtom(xpAtom)
  const maxStreak = useAtomValue(maxStreakAtom)
  const [coinsData] = useAtom(coinsAtom)
  const gems = useAtomValue(gemsAtom)
  const perfectDays = useAtomValue(perfectDayStreakAtom)
  const [shields] = useAtom(shieldsAtom)

  const coinBalance = coinsData.transactions.reduce((s, t) => s + t.amount, 0)
  const shieldsUsed = (xpData.shieldUsedDates ?? []).length
  const bossesDefeated = xpData.bossesDefeated ?? 0

  const titleCheckData: TitleCheckData = {
    maxStreak,
    shieldsUsed,
    perfectDays,
    gems,
    bossesDefeated,
    coinBalance,
  }

  const allTitles = TITLE_DEFINITIONS.map(def => ({
    ...def,
    isEarned: def.check(titleCheckData),
    isEquipped: xpData.activeTitle === def.id,
  }))

  const handleEquipTitle = async (titleId: string) => {
    const newActive = xpData.activeTitle === titleId ? null : titleId
    const updatedEquipped = newActive
      ? Array.from(new Set([...(xpData.equippedTitles ?? []), titleId]))
      : xpData.equippedTitles ?? []
    const updated = { ...xpData, activeTitle: newActive, equippedTitles: updatedEquipped }
    setXPData(updated)
    await saveXPData(updated)
    toast({
      title: newActive ? `Title equipped: ${TITLE_DEFINITIONS.find(t => t.id === titleId)?.title}` : 'Title removed',
      description: newActive ? 'Your title is now active.' : 'You removed your active title.',
    })
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/20">
          <Trophy className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Achievements</h1>
          <p className="text-sm text-muted-foreground">
            {unlockedAchievements.length} / {allAchievements.length} unlocked
          </p>
        </div>
      </div>

      {unlockedAchievements.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Unlocked</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {allAchievements.filter(a => a.isUnlocked).map(a => (
              <AchievementBadge key={a.id} achievement={a} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {unlockedAchievements.length > 0 ? 'Locked' : 'All Achievements'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {allAchievements.filter(a => !a.isUnlocked).map(a => (
            <AchievementBadge key={a.id} achievement={a} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Crown className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Titles</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allTitles.map(title => (
            <div
              key={title.id}
              className={`glass-card p-4 flex items-start gap-3 transition-all ${
                !title.isEarned ? 'opacity-50' : ''
              } ${title.isEquipped ? 'border border-amber-500/40' : ''}`}
            >
              <div className="text-3xl">{title.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-sm">{title.title}</p>
                  {title.isEquipped && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20 font-semibold">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{title.description}</p>
                {title.isEarned ? (
                  <button
                    onClick={() => handleEquipTitle(title.id)}
                    className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all ${
                      title.isEquipped
                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                        : 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
                    }`}
                  >
                    {title.isEquipped ? 'Remove' : 'Equip'}
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Not yet earned</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
