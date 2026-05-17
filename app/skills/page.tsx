'use client'

import { useAtomValue } from 'jotai'
import { xpAtom } from '@/lib/gamification-atoms'
import { getSkillNodesForCategory } from '@/lib/skill-trees'
import { HabitCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

const CATEGORIES: { category: HabitCategory; label: string; emoji: string }[] = [
  { category: 'fitness', label: 'Fitness', emoji: '💪' },
  { category: 'learning', label: 'Learning', emoji: '📖' },
  { category: 'mindfulness', label: 'Mindfulness', emoji: '🧘' },
  { category: 'social', label: 'Social', emoji: '🤝' },
  { category: 'creative', label: 'Creative', emoji: '🎨' },
  { category: 'productivity', label: 'Productivity', emoji: '🎯' },
  { category: 'health', label: 'Health', emoji: '🍎' },
]

export default function SkillsPage() {
  const xpData = useAtomValue(xpAtom)
  const skillProgress = xpData.skillProgress ?? {}
  const unlockedSkills = xpData.unlockedSkills ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">SKILL TREES</h1>
        <p className="section-label mt-1">LOG HABITS TO UNLOCK BONUSES</p>
      </div>

      <div className="space-y-5">
        {CATEGORIES.map(({ category, label, emoji }) => {
          const nodes = getSkillNodesForCategory(category)
          const progress = skillProgress[category] ?? 0
          const highestUnlocked = nodes.filter(n => unlockedSkills.includes(n.id)).pop()

          return (
            <div key={category} className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{emoji}</span>
                  <div>
                    <p className="font-bold text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{progress} completions</p>
                  </div>
                </div>
                {highestUnlocked && (
                  <span className="text-xs font-bold text-primary">+{highestUnlocked.xpBonusPct}% XP active</span>
                )}
              </div>

              {/* Skill chain */}
              <div className="flex items-center gap-2">
                {nodes.map((node, i) => {
                  const isUnlocked = unlockedSkills.includes(node.id)
                  const isInProgress = !isUnlocked && (i === 0 || unlockedSkills.includes(nodes[i - 1]?.id))
                  const pct = isUnlocked ? 100 : isInProgress ? Math.round((progress / node.requiredCompletions) * 100) : 0

                  return (
                    <div key={node.id} className="flex items-center flex-1">
                      <div className={cn(
                        'flex-1 rounded-lg p-3 text-center border transition-all',
                        isUnlocked
                          ? 'border-primary/60 bg-primary/10'
                          : isInProgress
                            ? 'border-border bg-card'
                            : 'border-border/30 bg-card/50 opacity-50'
                      )}>
                        <div className="text-lg mb-1">{node.emoji}</div>
                        <p className={cn('text-[10px] font-bold', isUnlocked ? 'text-primary' : 'text-foreground')}>{node.name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{node.requiredCompletions} habits</p>
                        {isInProgress && !isUnlocked && (
                          <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        )}
                        {isUnlocked && (
                          <p className="text-[9px] text-primary font-bold mt-1">+{node.xpBonusPct}% XP</p>
                        )}
                      </div>
                      {i < nodes.length - 1 && (
                        <div className={cn('w-4 h-0.5 mx-1 flex-shrink-0', isUnlocked ? 'bg-primary' : 'bg-border/30')} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
