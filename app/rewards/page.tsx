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
      <header><p className="section-label mb-2">Rewards</p><h1 className="page-title">Progress should unlock something meaningful.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Guaranteed progress comes first. Surprise rewards add delight without real-money loot boxes or manipulative scarcity.</p></header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/[0.06] p-5"><Coins className="h-5 w-5 text-amber-300" /><p className="mt-4 section-label">Available coins</p><p className="mt-1 text-4xl font-bold text-amber-200">{Math.max(0, coins).toLocaleString()}</p></div>
        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/[0.06] p-5"><Gem className="h-5 w-5 text-cyan-300" /><p className="mt-4 section-label">Rare gems</p><p className="mt-1 text-4xl font-bold text-cyan-200">{gems.toLocaleString()}</p></div>
      </div>
      <section className="grid gap-3 md:grid-cols-2">
        {destinations.map(item => <Link key={item.href} href={item.href} className="group min-h-40 rounded-2xl border border-border bg-card p-5 outline-none transition-colors hover:border-primary/30 hover:bg-primary/[0.035] focus-visible:ring-2 focus-visible:ring-ring"><item.icon className="h-5 w-5 text-primary" /><h2 className="mt-4 font-semibold">{item.title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p><span className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">Open <ArrowRight className="h-4 w-4" /></span></Link>)}
      </section>
    </div>
  )
}
