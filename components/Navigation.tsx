'use client'

import { Home, Calendar, Gift, Coins, FolderKanban, Trophy, ShoppingBag, Users, Heart, BarChart3, Sparkles, Flame, Swords, UserRound, Map } from 'lucide-react'
import { ElementType } from 'react'
import { useTranslations } from 'next-intl'
import { HabitIcon, TaskIcon } from '@/lib/constants'
import MobileNavDisplay from './MobileNavDisplay'
import DesktopNavDisplay from './DesktopNavDisplay'

type ViewPort = 'main' | 'mobile'

export interface NavItemType {
  icon: ElementType;
  label: string;
  href: string;
  group: 'primary' | 'planning' | 'community' | 'collection';
}

interface NavigationProps {
  className?: string
  viewPort: ViewPort
}


export default function Navigation({ className, viewPort }: NavigationProps) {
  const t = useTranslations('Navigation')

  const currentNavItems: NavItemType[] = [
    { icon: Home, label: 'Today', href: '/', group: 'primary' },
    { icon: HabitIcon, label: 'Quests', href: '/habits', group: 'primary' },
    { icon: UserRound, label: 'Character', href: '/character', group: 'primary' },
    { icon: Map, label: 'Journey', href: '/journey', group: 'primary' },
    { icon: Gift, label: 'Rewards', href: '/rewards', group: 'collection' },
    { icon: TaskIcon, label: 'Tasks', href: '/tasks', group: 'planning' },
    { icon: Calendar, label: t('calendar'), href: '/calendar', group: 'planning' },
    { icon: FolderKanban, label: 'Projects', href: '/projects', group: 'planning' },
    { icon: BarChart3, label: 'Stats', href: '/stats', group: 'planning' },
    { icon: Swords, label: 'League', href: '/league', group: 'community' },
    { icon: Users, label: 'Guild', href: '/guild', group: 'community' },
    { icon: Heart, label: 'Companion', href: '/pet', group: 'community' },
    { icon: Gift, label: t('wishlist'), href: '/wishlist', group: 'collection' },
    { icon: Coins, label: t('coins'), href: '/coins', group: 'collection' },
    { icon: Trophy, label: 'Achievements', href: '/achievements', group: 'collection' },
    { icon: ShoppingBag, label: 'Shop', href: '/shop', group: 'collection' },
    { icon: Sparkles, label: 'Skills', href: '/skills', group: 'collection' },
    { icon: Flame, label: 'Season', href: '/season', group: 'collection' },
  ]

  if (viewPort === 'mobile') {
    return <MobileNavDisplay navItems={currentNavItems} />
  }

  if (viewPort === 'main') {
    return <DesktopNavDisplay navItems={currentNavItems} className={className} />
  }

  return null
}
