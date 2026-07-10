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
          colors: ['#FF4D00', '#FF7A33', '#FFA366'],
        })
      })
    }
  }, [milestone])

  return (
    <Dialog open={!!milestone} onOpenChange={() => setMilestone(null)}>
      <DialogContent className="max-w-sm text-center border-border rounded-lg">
        {milestone && (
          <div className="py-6">
            <div className="text-6xl mb-4">{milestone.emoji}</div>
            <h2 className="text-2xl font-extrabold mb-1">Streak Milestone!</h2>
            <p className="text-lg font-bold text-primary mb-2">{milestone.label}</p>
            <p className="text-muted-foreground mb-4">
              {milestone.days}-day streak achieved. You&apos;re building real habits.
            </p>
            <div className="glass-card p-4 mb-6">
              <p className="text-2xl font-extrabold text-amber-400">+{milestone.coins} coins</p>
              <p className="text-xs text-muted-foreground">Milestone Reward</p>
            </div>
            <button
              onClick={() => setMilestone(null)}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              Keep going! 💪
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
