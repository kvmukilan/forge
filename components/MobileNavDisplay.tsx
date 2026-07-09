'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ElementType } from 'react'
import { LayoutGrid, Settings, X } from 'lucide-react'
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

// Tabs pinned to the bottom bar; everything else lives in the More drawer
const PRIMARY_HREFS = ['/', '/habits', '/tasks', '/stats']

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
  const [moreOpen, setMoreOpen] = useState(false)
  const isIOS = iOS()

  const primaryItems = PRIMARY_HREFS
    .map(href => navItems.find(item => item.href === href))
    .filter((item): item is NavItemType => !!item)
  const moreItems: NavItemType[] = [
    ...navItems.filter(item => !PRIMARY_HREFS.includes(item.href)),
    { icon: Settings, label: 'Settings', href: '/settings', position: 'bottom' },
  ]
  const moreActive = moreItems.some(item => pathname === item.href)

  // Close the drawer on navigation
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  return (
    <>
      <div className={isIOS ? 'pb-20' : 'pb-16'} />

      {/* More drawer */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={cn(
          'lg:hidden fixed left-0 right-0 z-40 bg-card border-t border-border rounded-t-2xl transition-transform duration-200 ease-out',
          isIOS ? 'bottom-[4.5rem]' : 'bottom-14',
          moreOpen ? 'translate-y-0' : 'translate-y-[120%] pointer-events-none'
        )}
        role="dialog"
        aria-label="More destinations"
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">More</span>
          <button onClick={() => setMoreOpen(false)} aria-label="Close" className="p-1 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 p-3 pb-5">
          {moreItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg py-3 transition-colors',
                  isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[0.55rem] font-semibold uppercase tracking-wide leading-tight text-center">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <nav className={cn(
        'lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border',
        isIOS && 'pb-4'
      )}>
        <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, 1fr)` }}>
          {primaryItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex flex-col items-center justify-center py-2.5 transition-colors gap-0.5',
                  isActive && !moreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && !moreOpen && 'drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]')} />
                <span className="text-[0.5rem] font-semibold uppercase tracking-wide leading-tight">
                  {item.label}
                </span>
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(open => !open)}
            className={cn(
              'flex flex-col items-center justify-center py-2.5 transition-colors gap-0.5',
              (moreOpen || moreActive) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-expanded={moreOpen}
          >
            <LayoutGrid className={cn('h-5 w-5', (moreOpen || moreActive) && 'drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]')} />
            <span className="text-[0.5rem] font-semibold uppercase tracking-wide leading-tight">
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
