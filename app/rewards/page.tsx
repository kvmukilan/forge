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
    <div className="space-y-6 animate-fade-in">
      <header><p className="section-label mb-2">Rewards</p><h1 className="page-title">Progress should unlock something meaningful.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Guaranteed progress comes first. Surprise rewards add delight without real-money loot boxes or manipulative scarcity.</p></header>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-h-24 items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-4"><span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-amber-500/10"><Coins className="h-5 w-5 text-amber-300" /></span><div><p className="section-label">Coins</p><p className="mt-1 text-2xl font-bold text-amber-200">{Math.max(0, coins).toLocaleString()}</p></div></div>
        <div className="flex min-h-24 items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.05] p-4"><span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-cyan-500/10"><Gem className="h-5 w-5 text-cyan-300" /></span><div><p className="section-label">Gems</p><p className="mt-1 text-2xl font-bold text-cyan-200">{gems.toLocaleString()}</p></div></div>
      </div>
      <section className="grid gap-2 md:grid-cols-2">
        {destinations.map(item => <Link key={item.href} href={item.href} className="group grid min-h-24 grid-cols-[2.75rem_1fr_auto] items-center gap-3 rounded-xl border border-border bg-card p-4 outline-none transition-colors hover:border-primary/30 hover:bg-primary/[0.035] focus-visible:ring-2 focus-visible:ring-ring"><span className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-primary"><item.icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{item.body}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" /></Link>)}
      </section>
    </div>
  )
}
