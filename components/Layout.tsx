'use client'

import ClientWrapper from './ClientWrapper'
import Header from './Header'
import Navigation from './Navigation'
import NotificationScheduler from './NotificationScheduler'
import { usePathname } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const immersive = pathname === '/onboarding'

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-background">
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <ClientWrapper>
        <NotificationScheduler />
        {!immersive && <Header className="sticky top-0 z-50" />}
        <div className="flex flex-1 overflow-hidden">
          {!immersive && <Navigation viewPort='main' />}
          <div className="flex min-w-0 flex-1 flex-col">
            <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-background outline-none">
              <div className={immersive
                ? 'mx-auto min-h-full w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10'
                : 'mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-10'}>
                {children}
              </div>
            </main>
            {!immersive && <Navigation viewPort='mobile' />}
          </div>
        </div>
      </ClientWrapper>
    </div>
  )
}

