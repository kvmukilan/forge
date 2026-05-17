'use client'

import { useAtom } from 'jotai'
import { milestoneModalAtom } from '@/lib/gamification-atoms'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useEffect } from 'react'

export default function MilestoneModal() {
  const [milestone, setMilestone] = useAtom(milestoneModalAtom)

  useEffect(() => {
    if (milestone) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#7c3aed', '#3b82f6', '#f59e0b'],
        })
      })
    }
  }, [milestone])

  return (
    <Dialog open={!!milestone} onOpenChange={() => setMilestone(null)}>
      <DialogContent className="max-w-sm text-center border-violet-500/30">
        {milestone && (
          <div className="py-6">
            <div className="text-6xl mb-4">{milestone.emoji}</div>
            <h2 className="text-2xl font-black mb-1">Streak Milestone!</h2>
            <p className="text-lg font-bold text-violet-400 mb-2">{milestone.label}</p>
            <p className="text-muted-foreground mb-4">
              {milestone.days}-day streak achieved. You&apos;re building real habits.
            </p>
            <div className="glass-card p-4 mb-6 border-amber-500/20">
              <p className="text-2xl font-black text-amber-400">+{milestone.coins} coins</p>
              <p className="text-xs text-muted-foreground">Milestone Reward</p>
            </div>
            <button
              onClick={() => setMilestone(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Keep going! 💪
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
