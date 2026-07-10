'use client'

import { useAtom } from 'jotai'
import { perfectDayModalAtom } from '@/lib/gamification-atoms'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useEffect } from 'react'

export default function PerfectDayModal() {
  const [open, setOpen] = useAtom(perfectDayModalAtom)

  useEffect(() => {
    if (open) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#FF4D00', '#FF7A33', '#FFA366', '#ffffff'],
        })
      })
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm text-center border-border rounded-lg">
        <div className="py-6">
          <div className="text-6xl mb-4">🌟</div>
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
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            Let&apos;s keep the streak! 🔥
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
