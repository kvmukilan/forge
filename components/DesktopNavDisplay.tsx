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

interface DesktopNavDisplayProps {
  navItems: NavItemType[];
  className?: string;
}

export default function DesktopNavDisplay({ navItems, className }: DesktopNavDisplayProps) {
  const pathname = usePathname()
  const mainItems = navItems.filter(item => item.position === 'main')
  const bottomItems = navItems.filter(item => item.position === 'bottom')

  const NavLink = ({ item }: { item: NavItemType }) => {
    const isActive = pathname === item.href
    return (
      <Link
        href={item.href}
        className={cn(
          'group flex items-center px-3 py-2 text-sm font-semibold transition-all duration-100 gap-3 border-l-2',
          isActive
            ? 'border-primary bg-primary/8 text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
        )}
      >
        <item.icon className={cn('h-4 w-4 flex-shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
        <span className={cn('tracking-wide', isActive ? 'text-primary' : '')}>{item.label}</span>
      </Link>
    )
  }

  return (
    <div className={cn('hidden lg:flex lg:flex-shrink-0', className)}>
      <div className="flex flex-col w-56">
        <div className="flex flex-col h-0 flex-1 border-r border-border bg-card/50">
          <div className="flex-1 flex flex-col pb-4 overflow-y-auto">
            {/* App branding */}
            <div className="px-4 py-5 mb-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-foreground text-xs font-black">F</span>
                </div>
                <span className="font-black text-sm tracking-widest uppercase text-foreground">Forge</span>
              </div>
            </div>

            <nav className="flex-1 space-y-0.5">
              {mainItems.map(item => <NavLink key={item.label} item={item} />)}
              {bottomItems.length > 0 && (
                <>
                  <div className="my-3 border-t border-border/60" />
                  {bottomItems.map(item => <NavLink key={item.label} item={item} />)}
                </>
              )}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}
