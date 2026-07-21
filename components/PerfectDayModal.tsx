'use client'

import { useAtom } from 'jotai'
import { perfectDayModalAtom } from '@/lib/gamification-atoms'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useEffect } from 'react'
import { celebrate } from '@/lib/celebration'
import { Star } from 'lucide-react'

export default function PerfectDayModal() {
  const [open, setOpen] = useAtom(perfectDayModalAtom)

  useEffect(() => {
    if (open) {
      celebrate('milestone')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm text-center border-border rounded-lg">
        <div className="py-6">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-primary/25 bg-primary/10" aria-hidden="true">
            <Star className="h-8 w-8 fill-primary/20 text-primary" />
          </div>
          <h2 className="text-2xl font-extrabold mb-2 text-primary">Perfect Day!</h2>
          <p className="text-muted-foreground mb-4">
            You completed every single habit today. That&apos;s elite discipline.
          </p>
          <div className="glass-card p-4 mb-6">
            <p className="text-2xl font-extrabold text-primary">+200 XP</p>
            <p className="text-xs text-muted-foreground">Perfect Day Bonus</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="min-h-11 w-full rounded-xl bg-primary px-4 text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            Keep the streak
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
