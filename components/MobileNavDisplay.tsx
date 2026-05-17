'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ElementType } from 'react'
import { cn } from '@/lib/utils'

export interface NavItemType {
  icon: ElementType;
  label: string;
  href: string;
  position: 'main' | 'bottom';
}

interface MobileNavDisplayProps {
  navItems: NavItemType[];
}

function iOS() {
  if (typeof navigator === 'undefined') return false
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod',
  ].includes(navigator.platform)
    || (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
}

export default function MobileNavDisplay({ navItems }: MobileNavDisplayProps) {
  const pathname = usePathname()
  const mobileNavItems = navItems.filter(item => item.position === 'main')
  const isIOS = iOS()

  return (
    <>
      <div className={isIOS ? 'pb-20' : 'pb-16'} />
      <nav className={cn(
        'lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border',
        isIOS && 'pb-4'
      )}>
        <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, 1fr)` }}>
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center py-2.5 transition-colors gap-0.5',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]')} />
                <span className="text-[0.5rem] font-semibold uppercase tracking-wide leading-tight">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
