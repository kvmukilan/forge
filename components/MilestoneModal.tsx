'use client'

import { useAtom } from 'jotai'
import { milestoneModalAtom } from '@/lib/gamification-atoms'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useEffect } from 'react'
import { celebrate } from '@/lib/celebration'
import { Trophy } from 'lucide-react'

export default function MilestoneModal() {
  const [milestone, setMilestone] = useAtom(milestoneModalAtom)

  useEffect(() => {
    if (milestone) {
      celebrate('milestone')
    }
  }, [milestone])

  return (
    <Dialog open={!!milestone} onOpenChange={() => setMilestone(null)}>
      <DialogContent className="max-w-sm text-center border-border rounded-lg">
        {milestone && (
          <div className="py-6">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-primary/25 bg-primary/10" aria-hidden="true">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
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
              className="min-h-11 w-full rounded-xl bg-primary px-4 text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              Keep going
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
