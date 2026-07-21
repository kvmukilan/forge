'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { LayoutGrid, Settings, X } from 'lucide-react'
import type { NavItemType } from './Navigation'
import { cn } from '@/lib/utils'

interface MobileNavDisplayProps {
  navItems: NavItemType[];
}

const PRIMARY_HREFS = ['/', '/habits', '/character', '/journey']
const GROUP_LABELS: Record<Exclude<NavItemType['group'], 'primary'> | 'featured', string> = {
  featured: 'Featured',
  planning: 'Plan & review',
  community: 'Community',
  collection: 'Collection',
}

function isCurrentPath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export default function MobileNavDisplay({ navItems }: MobileNavDisplayProps) {
  const pathname = usePathname()
  const primaryItems = PRIMARY_HREFS
    .map(href => navItems.find(item => item.href === href))
    .filter((item): item is NavItemType => Boolean(item))
  const moreItems = navItems.filter(item => !PRIMARY_HREFS.includes(item.href))
  const moreActive = moreItems.some(item => isCurrentPath(pathname, item.href)) || pathname === '/settings'

  const SheetLink = ({ item }: { item: NavItemType }) => {
    const active = isCurrentPath(pathname, item.href)
    return (
      <Dialog.Close asChild>
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none transition-colors active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring',
            active ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
          )}
        >
          <item.icon className={cn('h-5 w-5 stroke-[1.8]', active && 'text-primary')} />
          <span>{item.label}</span>
        </Link>
      </Dialog.Close>
    )
  }

  return (
    <Dialog.Root>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Primary navigation"
      >
        <div className="grid h-16 grid-cols-5 px-1">
          {primaryItems.map(item => {
            const active = isCurrentPath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'text-foreground' : 'text-muted-foreground active:bg-secondary'
                )}
              >
                <span className={cn('absolute top-1 h-0.5 w-5 rounded-full bg-primary opacity-0', active && 'opacity-100')} />
                <item.icon className={cn('h-5 w-5 stroke-[1.8]', active && 'text-primary')} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          <Dialog.Trigger asChild>
            <button
              type="button"
              className={cn(
                'relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-muted-foreground outline-none transition-colors active:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                moreActive && 'text-foreground'
              )}
              aria-label="Open more destinations"
            >
              <span className={cn('absolute top-1 h-0.5 w-5 rounded-full bg-primary opacity-0', moreActive && 'opacity-100')} />
              <LayoutGrid className={cn('h-5 w-5 stroke-[1.8]', moreActive && 'text-primary')} />
              <span>More</span>
            </button>
          </Dialog.Trigger>
        </div>
      </nav>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[70] max-h-[78dvh] overflow-y-auto overscroll-contain rounded-t-[1.75rem] border-t border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-24px_80px_-32px_rgba(0,0,0,0.8)] outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom lg:hidden">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4 px-1 pb-3">
            <div>
              <Dialog.Title className="text-xl font-bold tracking-tight">Your Forge</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">Planning, community, and everything you earn.</Dialog.Description>
            </div>
            <Dialog.Close className="grid min-h-11 min-w-11 place-items-center rounded-full border border-border text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close more destinations">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="space-y-5 pb-2">
            {(Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map(group => {
              const items = group === 'featured'
                ? moreItems.filter(item => item.group === 'primary')
                : moreItems.filter(item => item.group === group)
              if (items.length === 0) return null
              return (
                <section key={group} aria-labelledby={`mobile-${group}-label`}>
                  <h2 id={`mobile-${group}-label`} className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/75">
                    {GROUP_LABELS[group]}
                  </h2>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {items.map(item => <SheetLink key={item.href} item={item} />)}
                  </div>
                </section>
              )
            })}

            <section className="border-t border-border/70 pt-3">
              <Dialog.Close asChild>
                <Link href="/settings" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                  <Settings className="h-5 w-5 stroke-[1.8]" />
                  Settings
                </Link>
              </Dialog.Close>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
