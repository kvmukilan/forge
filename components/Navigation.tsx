'use client'

import { Home, Calendar, Gift, Coins, FolderKanban, Trophy, ShoppingBag, Users, Heart, BarChart3, Sparkles, Flame, Swords, UserRound, Map } from 'lucide-react'
import { useEffect, useState, ElementType } from 'react'
import { useTranslations } from 'next-intl'
import { HabitIcon, TaskIcon } from '@/lib/constants'
import MobileNavDisplay from './MobileNavDisplay'
import DesktopNavDisplay from './DesktopNavDisplay'

type ViewPort = 'main' | 'mobile'

export interface NavItemType {
  icon: ElementType;
  label: string;
  href: string;
  position: 'main' | 'bottom';
}

interface NavigationProps {
  className?: string
  viewPort: ViewPort
}


export default function Navigation({ className, viewPort }: NavigationProps) {
  const t = useTranslations('Navigation')
  const [isMobileView, setIsMobileView] = useState(false)

  const currentNavItems: NavItemType[] = [
    { icon: Home, label: 'Today', href: '/', position: 'main' },
    { icon: HabitIcon, label: 'Quests', href: '/habits', position: 'main' },
    { icon: UserRound, label: 'Character', href: '/character', position: 'main' },
    { icon: Map, label: 'Journey', href: '/journey', position: 'main' },
    { icon: Gift, label: 'Rewards', href: '/rewards', position: 'main' },
    { icon: TaskIcon, label: 'Tasks', href: '/tasks', position: 'bottom' },
    { icon: BarChart3, label: 'Stats', href: '/stats', position: 'bottom' },
    { icon: Gift, label: t('wishlist'), href: '/wishlist', position: 'bottom' },
    { icon: Swords, label: 'League', href: '/league', position: 'bottom' },
    { icon: Coins, label: t('coins'), href: '/coins', position: 'bottom' },
    { icon: Calendar, label: t('calendar'), href: '/calendar', position: 'bottom' },
    { icon: FolderKanban, label: 'Projects', href: '/projects', position: 'bottom' },
    { icon: Users, label: 'Guild', href: '/guild', position: 'bottom' },
    { icon: Heart, label: 'Companion', href: '/pet', position: 'bottom' },
    { icon: Trophy, label: 'Achievements', href: '/achievements', position: 'bottom' },
    { icon: ShoppingBag, label: 'Shop', href: '/shop', position: 'bottom' },
    { icon: Sparkles, label: 'Skills', href: '/skills', position: 'bottom' },
    { icon: Flame, label: 'Season', href: '/season', position: 'bottom' },
  ]

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 1024)
    }

    // Set initial value
    handleResize()

    // Add event listener
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (viewPort === 'mobile' && isMobileView) {
    return <MobileNavDisplay navItems={currentNavItems} />
  }

  if (viewPort === 'main' && !isMobileView) {
    return <DesktopNavDisplay navItems={currentNavItems} className={className} />
  }

  return null // Explicitly return null if no view matches
}
