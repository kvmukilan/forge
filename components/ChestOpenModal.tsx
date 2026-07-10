'use client'

import { useState } from 'react'
import confetti from 'canvas-confetti'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { openChest, type ChestSource, type ChestReward } from '@/app/actions/retention'
import { Coins, Gem, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const REWARD_ICONS = {
  coins: Coins,
  gems: Gem,
  boost: Zap,
  shield: Shield,
} as const

interface ChestOpenModalProps {
  source: ChestSource
  onClose: () => void
  onOpened?: () => void
}

export default function ChestOpenModal({ source, onClose, onOpened }: ChestOpenModalProps) {
  const [opening, setOpening] = useState(false)
  const [reward, setReward] = useState<ChestReward | null>(null)
  const [error, setError] = useState('')

  const handleOpen = async () => {
    setOpening(true)
    setError('')
    try {
      const result = await openChest(source)
      if (!result.success || !result.reward) {
        setError(result.message)
        return
      }
      setReward(result.reward)
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      onOpened?.()
    } catch {
      setError('Something went wrong')
    } finally {
      setOpening(false)
    }
  }

  const RewardIcon = reward ? REWARD_ICONS[reward.kind] : null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xs text-center">
        <DialogTitle className="text-sm font-black uppercase tracking-widest text-center">
          Mystery Chest
        </DialogTitle>

        {!reward ? (
          <div className="py-4 space-y-5">
            <div className={cn('text-6xl select-none', opening && 'animate-bounce')} aria-hidden>
              🎁
            </div>
            <p className="text-xs text-muted-foreground">
              {source === 'login_day7' ? 'Seven-day login streak reward' : 'All daily quests complete'}
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              onClick={handleOpen}
              disabled={opening}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {opening ? 'Opening…' : 'Open chest'}
            </button>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
              {RewardIcon && <RewardIcon className="h-8 w-8 text-primary" />}
            </div>
            <div>
              <p className="text-lg font-black">{reward.label}</p>
              <p className="text-xs text-muted-foreground mt-1">Added to your account</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-secondary font-bold text-sm hover:bg-secondary/80 transition-colors"
            >
              Nice!
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
