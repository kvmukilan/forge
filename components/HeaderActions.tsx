'use client'

import Link from 'next/link'
import { useAtom } from 'jotai'
import { settingsAtom } from '@/lib/atoms'
import { useCoins } from '@/hooks/useCoins'
import { FormattedNumber } from '@/components/FormattedNumber'
import { Coins } from 'lucide-react'
import NotificationBell from './NotificationBell'
import dynamic from 'next/dynamic'
import { Profile } from './Profile'

const TodayEarnedCoins = dynamic(() => import('./TodayEarnedCoins'), { ssr: false })

export default function HeaderActions() {
  const [settings] = useAtom(settingsAtom)
  const { balance } = useCoins()

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link href="/coins" className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full transition-colors border border-border">
        <Coins className="h-4 w-4 text-amber-400" />
        <div className="flex items-baseline gap-1.5">
          <FormattedNumber
            amount={balance}
            settings={settings}
            className="text-foreground font-semibold text-sm tabular-nums"
          />
          <div className="hidden sm:block">
            <TodayEarnedCoins />
          </div>
        </div>
      </Link>
      <NotificationBell />
      <Profile />
    </div>
  )
}
