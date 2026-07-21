'use client'

import { useAtom } from 'jotai'
import { levelUpAtom } from '@/lib/gamification-atoms'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { celebrate } from '@/lib/celebration'

export default function LevelUpModal() {
  const [levelUp, setLevelUp] = useAtom(levelUpAtom)

  useEffect(() => {
    if (levelUp === null) return
    celebrate('milestone')
  }, [levelUp])

  if (levelUp === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-card p-8 max-w-sm w-full mx-4 text-center animate-level-up">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Zap className="h-10 w-10 text-primary" />
          </div>
        </div>
        <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-1">Level Up!</p>
        <h2 className="text-4xl font-extrabold text-primary mb-2">{levelUp}</h2>
        <p className="text-muted-foreground mb-6">You reached Level {levelUp}! Keep building those habits.</p>
        <Button
          className="min-h-11 w-full bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors"
          onClick={() => setLevelUp(null)}
        >
          Continue forging
        </Button>
      </div>
    </div>
  )
}
