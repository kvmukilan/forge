'use client'

import Link from 'next/link'
import { useAtomValue } from 'jotai'
import { ArrowRight, Coins, Gem, Gift, Heart, ShoppingBag, Trophy } from 'lucide-react'
import { coinsAtom } from '@/lib/atoms'
import { gemsAtom } from '@/lib/gamification-atoms'

export default function RewardsPage() {
  const coins = useAtomValue(coinsAtom).transactions.reduce((sum, item) => sum + item.amount, 0)
  const gems = useAtomValue(gemsAtom)
  const destinations = [
    { href: '/wishlist', icon: Gift, title: 'Personal reward vault', body: 'Turn earned coins into real rewards you chose yourself.' },
    { href: '/shop', icon: ShoppingBag, title: 'Forge shop', body: 'Spend rare currency on shields, boosts, and utility.' },
    { href: '/pet', icon: Heart, title: 'Companion', body: 'Care for a companion that evolves alongside your consistency.' },
    { href: '/achievements', icon: Trophy, title: 'Collection', body: 'Review unlocked achievements, titles, and milestones.' },
  ]
  return (
    <div className="space-y-7 animate-fade-in">
      <header><p className="section-label mb-2">Rewards</p><h1 className="page-title normal-case">Progress should unlock something meaningful.</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Guaranteed progress comes first. Surprise rewards add delight without real-money loot boxes or manipulative scarcity.</p></header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-5"><Coins className="h-5 w-5 text-amber-300" /><p className="mt-4 section-label">Available coins</p><p className="mt-1 text-4xl font-black text-amber-200">{Math.max(0, coins).toLocaleString()}</p></div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-5"><Gem className="h-5 w-5 text-cyan-300" /><p className="mt-4 section-label">Rare gems</p><p className="mt-1 text-4xl font-black text-cyan-200">{gems.toLocaleString()}</p></div>
      </div>
      <section className="grid gap-3 md:grid-cols-2">
        {destinations.map(item => <Link key={item.href} href={item.href} className="group rounded-2xl border border-border bg-card p-5 hover:border-violet-400/30"><item.icon className="h-5 w-5 text-violet-300" /><h2 className="mt-4 font-black">{item.title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-300">Open <ArrowRight className="h-3.5 w-3.5" /></span></Link>)}
      </section>
    </div>
  )
}
