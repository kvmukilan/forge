'use client'

import PetCard from '@/components/PetCard'
import { Heart, Sparkles, HeartCrack, Gem, TrendingUp } from 'lucide-react'

export default function PetPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <Heart className="h-5 w-5 text-primary" />
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
          <p className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary shrink-0" /> Complete 80%+ of habits daily → pet gains Evolution XP</p>
          <p className="flex items-center gap-2"><HeartCrack className="h-4 w-4 text-red-400 shrink-0" /> Fall below 50% → pet loses HP</p>
          <p className="flex items-center gap-2"><Gem className="h-4 w-4 text-primary shrink-0" /> Feed with gems → restore HP + gain XP</p>
          <p className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" /> Fill Evolution XP bar → pet evolves to next form</p>
        </div>
      </div>
    </div>
  )
}
