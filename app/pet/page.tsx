'use client'

import PetCard from '@/components/PetCard'
import { Heart } from 'lucide-react'

export default function PetPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/20">
          <Heart className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="page-title">Companion</h1>
          <p className="text-sm text-muted-foreground">Your habit buddy grows with you</p>
        </div>
      </div>

      <PetCard />

      <div className="glass-card p-5 space-y-3">
        <p className="section-label">How it works</p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>🌟 Complete 80%+ of habits daily → pet gains Evolution XP</p>
          <p>💔 Fall below 50% → pet loses HP</p>
          <p>💎 Feed with gems → restore HP + gain XP</p>
          <p>✨ Fill Evolution XP bar → pet evolves to next form</p>
        </div>
      </div>
    </div>
  )
}
