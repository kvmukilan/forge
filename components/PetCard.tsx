'use client'

import { useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { petDataAtom, gemsAtom, xpAtom } from '@/lib/gamification-atoms'
import { feedPet, adoptPet } from '@/app/actions/pets'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PetForm } from '@/lib/types'
import Link from 'next/link'

const PET_EMOJI: Record<PetForm, string> = {
  egg: '🥚',
  hatchling: '🐣',
  companion: '🦎',
  guardian: '🐲',
  legend: '🐉',
}

const MOOD_LABEL: Record<string, string> = {
  ecstatic: '🌟 Ecstatic',
  happy: '😊 Happy',
  neutral: '😐 Neutral',
  sad: '😢 Sad',
  distressed: '💔 Distressed',
}

const FEED_COST = 10

export default function PetCard({ compact = false }: { compact?: boolean }) {
  const [petData, setPetData] = useAtom(petDataAtom)
  const [, setXpData] = useAtom(xpAtom)
  const gems = useAtomValue(gemsAtom)
  const [petName, setPetName] = useState('')
  const [feeding, setFeeding] = useState(false)
  const [adopting, setAdopting] = useState(false)

  const pet = petData.pet

  const handleAdopt = async () => {
    setAdopting(true)
    const newPet = await adoptPet(petName || 'Pip')
    setPetData({ pet: newPet })
    toast({ title: `${newPet.name} has hatched! 🥚`, description: 'Your companion is ready.' })
    setAdopting(false)
  }

  const handleFeed = async () => {
    if (gems < FEED_COST) {
      toast({ title: `Need ${FEED_COST} gems`, description: `You have ${gems} gems.`, variant: 'destructive' })
      return
    }
    setFeeding(true)
    const result = await feedPet(FEED_COST)
    if (result.success && result.pet) {
      setPetData({ pet: result.pet })
      if (result.xpData) setXpData(result.xpData)
      const evolved = result.pet.xp === 0 && result.pet.form !== 'egg'
      toast({
        title: evolved ? `${result.pet.name} evolved! ✨` : `${result.pet.name} loved that!`,
        description: evolved ? `Now a ${result.pet.form}!` : '+20 HP, +50 XP',
      })
    } else if (result.message) {
      toast({ title: result.message, variant: 'destructive' })
    }
    setFeeding(false)
  }

  if (!pet) {
    if (compact) {
      return (
        <div className="glass-card p-4 flex items-center gap-3">
          <span className="text-2xl">🥚</span>
          <div className="flex-1">
            <p className="section-label">Companion</p>
            <p className="text-sm text-muted-foreground">No pet yet</p>
          </div>
          <Link href="/pet" className="text-xs text-violet-400 font-semibold hover:text-violet-300">Adopt →</Link>
        </div>
      )
    }
    return (
      <div className="glass-card p-6 text-center space-y-4">
        <div className="text-6xl">🥚</div>
        <div>
          <p className="font-bold text-lg">Adopt a Companion</p>
          <p className="text-sm text-muted-foreground mt-1">Your pet grows stronger as you build habits.</p>
        </div>
        <div className="flex gap-2 max-w-xs mx-auto">
          <Input
            value={petName}
            onChange={e => setPetName(e.target.value)}
            placeholder="Name your pet"
            className="bg-white/5 border-white/10"
          />
          <Button
            onClick={handleAdopt}
            disabled={adopting}
            className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0 shrink-0"
          >
            Adopt
          </Button>
        </div>
      </div>
    )
  }

  const hpPct = Math.round((pet.hp / pet.maxHp) * 100)
  const xpPct = pet.xpToNextForm >= 9999999 ? 100 : Math.round((pet.xp / pet.xpToNextForm) * 100)
  const hpBarColor =
    pet.mood === 'ecstatic' || pet.mood === 'happy'
      ? 'from-emerald-500 to-emerald-400'
      : pet.mood === 'neutral'
      ? 'from-amber-500 to-amber-400'
      : 'from-red-600 to-red-400'

  if (compact) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{PET_EMOJI[pet.form]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm truncate">{pet.name}</p>
              <span className="text-xs text-muted-foreground capitalize">{pet.form}</span>
            </div>
            <p className="text-xs text-muted-foreground">{MOOD_LABEL[pet.mood]}</p>
          </div>
          <Link href="/pet" className="text-xs text-violet-400 font-semibold hover:text-violet-300 shrink-0">View →</Link>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>HP</span><span>{pet.hp}/{pet.maxHp}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', hpBarColor)}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <span className="text-7xl">{PET_EMOJI[pet.form]}</span>
          {pet.mood === 'ecstatic' && <span className="absolute -top-1 -right-1 text-lg animate-bounce">✨</span>}
          {pet.mood === 'distressed' && <span className="absolute -top-1 -right-1 text-lg">💔</span>}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black">{pet.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 capitalize border border-violet-500/20">
              {pet.form}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{MOOD_LABEL[pet.mood]}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="section-label">Health</span>
            <span className="text-muted-foreground tabular-nums">{pet.hp} / {pet.maxHp}</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', hpBarColor)}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="section-label">Evolution XP</span>
            <span className="text-muted-foreground tabular-nums">
              {pet.xpToNextForm >= 9999999 ? 'MAX' : `${pet.xp} / ${pet.xpToNextForm}`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleFeed}
          disabled={feeding || gems < FEED_COST}
          className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0"
        >
          💎 Feed ({FEED_COST} gems)
        </Button>
      </div>
      {gems < FEED_COST && (
        <p className="text-xs text-muted-foreground text-center">
          You have {gems} gem{gems !== 1 ? 's' : ''}. Complete habits to earn more.
        </p>
      )}
    </div>
  )
}
