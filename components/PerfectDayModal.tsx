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
          colors: ['#f59e0b', '#fbbf24', '#fde68a', '#7c3aed', '#ffffff'],
        })
      })
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm text-center border-amber-500/30 bg-gradient-to-b from-amber-950/90 to-background">
        <div className="py-6">
          <div className="text-6xl mb-4">🌟</div>
          <h2 className="text-3xl font-black mb-2 text-amber-400">Perfect Day!</h2>
          <p className="text-muted-foreground mb-4">
            You completed every single habit today. That&apos;s elite discipline.
          </p>
          <div className="glass-card p-4 mb-6 border-amber-500/20">
            <p className="text-2xl font-black text-amber-400">+200 XP</p>
            <p className="text-xs text-muted-foreground">Perfect Day Bonus</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Let&apos;s keep the streak! 🔥
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
