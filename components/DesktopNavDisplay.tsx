'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, Library, Settings } from 'lucide-react'
import type { NavItemType } from './Navigation'
import { cn } from '@/lib/utils'

interface DesktopNavDisplayProps {
  navItems: NavItemType[];
  className?: string;
}

const GROUP_LABELS: Record<Exclude<NavItemType['group'], 'primary'>, string> = {
  planning: 'Plan & review',
  community: 'Community',
  collection: 'Collection',
}

function isCurrentPath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export default function DesktopNavDisplay({ navItems, className }: DesktopNavDisplayProps) {
  const pathname = usePathname()
  const primaryItems = navItems.filter(item => item.group === 'primary')
  const secondaryItems = navItems.filter(item => item.group !== 'primary')
  const secondaryActive = secondaryItems.some(item => isCurrentPath(pathname, item.href))
  const [libraryOpen, setLibraryOpen] = useState(secondaryActive)

  useEffect(() => {
    if (secondaryActive) setLibraryOpen(true)
  }, [secondaryActive])

  const NavLink = ({ item, compact = false }: { item: NavItemType; compact?: boolean }) => {
    const active = isCurrentPath(pathname, item.href)
    return (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          compact && 'min-h-10 text-[13px]',
          active
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
        )}
      >
        <span className={cn('absolute left-0 h-5 w-0.5 rounded-full bg-primary opacity-0', active && 'opacity-100')} />
        <item.icon className={cn('h-[18px] w-[18px] flex-none stroke-[1.8]', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <aside className={cn('hidden w-56 flex-none border-r border-border/70 bg-card/25 lg:flex lg:flex-col', className)} aria-label="Primary navigation">
      <div className="flex min-h-16 items-center gap-3 px-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-sm font-black text-background">F</div>
        <div>
          <p className="text-sm font-extrabold tracking-[0.16em]">FORGE</p>
          <p className="text-[11px] text-muted-foreground">Build the next level</p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col px-3 pb-3" aria-label="Forge">
        <div className="space-y-1 pt-3">
          {primaryItems.map(item => <NavLink key={item.href} item={item} />)}
        </div>

        <div className="my-4 h-px bg-border/70" />

        <button
          type="button"
          onClick={() => setLibraryOpen(open => !open)}
          className={cn(
            'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            secondaryActive && 'text-foreground'
          )}
          aria-expanded={libraryOpen}
          aria-controls="desktop-library-navigation"
        >
          <Library className="h-[18px] w-[18px] stroke-[1.8]" />
          <span className="flex-1 text-left">Library</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', libraryOpen && 'rotate-180')} />
        </button>

        <div
          id="desktop-library-navigation"
          className={cn('min-h-0 overflow-y-auto overscroll-contain pt-2', !libraryOpen && 'hidden')}
        >
          {(Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map(group => (
            <section key={group} className="mb-3" aria-labelledby={`desktop-${group}-label`}>
              <h2 id={`desktop-${group}-label`} className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                {GROUP_LABELS[group]}
              </h2>
              <div className="space-y-0.5">
                {secondaryItems.filter(item => item.group === group).map(item => <NavLink key={item.href} item={item} compact />)}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-auto border-t border-border/70 pt-3">
          <Link
            href="/settings"
            aria-current={pathname === '/settings' ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
              pathname === '/settings' && 'bg-secondary text-foreground'
            )}
          >
            <Settings className="h-[18px] w-[18px] stroke-[1.8]" />
            Settings
          </Link>
        </div>
      </nav>
    </aside>
  )
}
