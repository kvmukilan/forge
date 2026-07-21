import { Logo } from '@/components/Logo'
import Link from 'next/link'
import HeaderActions from './HeaderActions'

interface HeaderProps {
  className?: string
}

export default function Header({ className }: HeaderProps) {
  return (
    <header className={`border-b border-border/70 bg-background/88 backdrop-blur-xl ${className || ''}`}>
      <div className="mx-auto px-3 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Logo: hidden on desktop (sidebar handles branding) */}
          <Link href="/" className="mr-2 shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden" aria-label="Forge home">
            <Logo />
          </Link>
          {/* Spacer so actions stay right-aligned on desktop */}
          <div className="hidden lg:block" />
          <HeaderActions />
        </div>
      </div>
    </header>
  )
}
