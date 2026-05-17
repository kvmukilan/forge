'use client'

import { useAtom } from 'jotai'
import { xpAtom, shieldsAtom, activeBoostsAtom } from '@/lib/gamification-atoms'
import { coinsAtom } from '@/lib/atoms'
import ShopItem from '@/components/ShopItem'
import { buyStreakShield, buyBoost } from '@/app/actions/gamification'
import { toast } from '@/hooks/use-toast'
import { ShoppingBag } from 'lucide-react'

export default function ShopPage() {
  const [xpData, setXPData] = useAtom(xpAtom)
  const [coinsData, setCoinsData] = useAtom(coinsAtom)
  const [shields] = useAtom(shieldsAtom)
  const [activeBoosts] = useAtom(activeBoostsAtom)

  const balance = coinsData.transactions.reduce((s, t) => s + t.amount, 0)
  const gems = xpData.gems ?? 0

  const handleBuyShield = async () => {
    const result = await buyStreakShield()
    setXPData(result.xpData)
    toast({
      title: result.success ? '🛡️ Shield Purchased!' : 'Not enough coins',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })
  }

  const handleBuyBoost = async (type: 'xp_2x' | 'coins_2x' | 'gem_boost') => {
    const result = await buyBoost(type)
    setXPData(result.xpData)
    // Reload coins to reflect deduction
    const { loadCoinsData } = await import('@/app/actions/data')
    const updatedCoins = await loadCoinsData()
    setCoinsData(updatedCoins)
    toast({
      title: result.success ? '⚡ Boost Activated!' : 'Not enough coins',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    })
  }

  const hasBoost = (type: string) => activeBoosts.some(b => b.type === type)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/20">
          <ShoppingBag className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Power-Up Shop</h1>
          <p className="text-sm text-muted-foreground">Spend coins to boost your progress</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-amber-400 font-bold">🪙 {Math.max(0, balance)}</span>
          <span className="text-cyan-400 font-bold">💎 {gems}</span>
          <span className="text-blue-400 font-bold">🛡️ {shields}/3</span>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Protection</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ShopItem
            emoji="🛡️"
            name="Streak Shield"
            description="Protects your streak if you miss a day. Max 3 at once."
            cost={75}
            badge={shields >= 3 ? 'Max' : undefined}
            onBuy={handleBuyShield}
            disabled={shields >= 3 || balance < 75}
          />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Boosts (Time-Limited)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ShopItem
            emoji="⚡"
            name="2× XP Boost"
            description="Double XP for 24 hours. Stack your best day."
            cost={100}
            badge={hasBoost('xp_2x') ? 'Active' : '24h'}
            onBuy={() => handleBuyBoost('xp_2x')}
            disabled={hasBoost('xp_2x') || balance < 100}
          />
          <ShopItem
            emoji="🪙"
            name="2× Coins Boost"
            description="Double coins earned for 24 hours."
            cost={150}
            badge={hasBoost('coins_2x') ? 'Active' : '24h'}
            onBuy={() => handleBuyBoost('coins_2x')}
            disabled={hasBoost('coins_2x') || balance < 150}
          />
          <ShopItem
            emoji="💎"
            name="Gem Booster"
            description="30% gem drop chance for 12 hours (normally 15%)."
            cost={250}
            badge={hasBoost('gem_boost') ? 'Active' : '12h'}
            onBuy={() => handleBuyBoost('gem_boost')}
            disabled={hasBoost('gem_boost') || balance < 250}
          />
        </div>
      </div>
    </div>
  )
}
