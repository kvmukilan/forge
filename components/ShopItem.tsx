'use client'

import { Coins } from 'lucide-react'

interface ShopItemProps {
  emoji: string
  name: string
  description: string
  cost: number
  badge?: string
  onBuy: () => void
  disabled?: boolean
}

export default function ShopItem({ emoji, name, description, cost, badge, onBuy, disabled }: ShopItemProps) {
  return (
    <div className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="text-3xl">{emoji}</div>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
            {badge}
          </span>
        )}
      </div>
      <div>
        <h3 className="font-bold text-sm">{name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={onBuy}
        disabled={disabled}
        className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
      >
        <Coins className="h-3.5 w-3.5" /> {cost} coins
      </button>
    </div>
  )
}
