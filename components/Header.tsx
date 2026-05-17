import { Logo } from '@/components/Logo'
import Link from 'next/link'
import HeaderActions from './HeaderActions'

interface HeaderProps {
  className?: string
}

export default function Header({ className }: HeaderProps) {
  return (
    <header className={`border-b border-border bg-card/95 backdrop-blur-sm ${className || ''}`}>
      <div className="mx-auto py-3 px-4 sm:px-6">
        <div className="flex items-center justify-between">
          {/* Logo: hidden on desktop (sidebar handles branding) */}
          <Link href="/" className="mr-3 lg:hidden">
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
