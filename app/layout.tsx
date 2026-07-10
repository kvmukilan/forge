import './globals.css'
import { Geist } from 'next/font/google'
import { JotaiProvider } from '@/components/jotai-providers'
import ErrorBoundary from '@/components/ErrorBoundary'
import { loadSettings, loadHabitsData, loadCoinsData, loadWishlistData, loadUsersPublicData, loadServerSettings } from './actions/data'
import { loadXPData, loadProjectsData, loadBossData } from './actions/gamification'
import { loadGuildData } from '@/app/actions/guilds'
import { loadPetData } from '@/app/actions/pets'
import Layout from '@/components/Layout'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Suspense } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'


const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

const activeFont = geist

export const metadata = {
  title: 'Forge',
  description: 'Forge your best self — gamified habits, quests & guilds',
}

export const dynamic = 'force-dynamic' // needed to prevent nextjs from caching the load... functions in Layout component

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale();
  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  const [initialSettings, initialHabits, initialCoins, initialWishlist, initialUsers, initialServerSettings, initialXP, initialProjects, initialBoss, initialGuild, initialPet] = await Promise.all([
    loadSettings(),
    loadHabitsData(),
    loadCoinsData(),
    loadWishlistData(),
    loadUsersPublicData(),
    loadServerSettings(),
    loadXPData(),
    loadProjectsData(),
    loadBossData(),
    loadGuildData(),
    loadPetData(),
  ])

  return (
    // set suppressHydrationWarning to true to prevent hydration errors when using ThemeProvider (https://ui.shadcn.com/docs/dark-mode/next)
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body className={activeFont.className}>
        <JotaiProvider
          initialValues={{
            settings: initialSettings,
            habits: initialHabits,
            coins: initialCoins,
            wishlist: initialWishlist,
            users: initialUsers,
            serverSettings: initialServerSettings,
            xp: initialXP,
            projects: initialProjects,
            boss: initialBoss,
            guild: initialGuild,
            pet: initialPet,
          }}
        >
          <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
              <NextIntlClientProvider locale={locale} messages={messages}>
                <ThemeProvider
                  attribute="class"
                  forcedTheme="dark"
                  disableTransitionOnChange
                >
                  <SessionProvider>
                    <Layout>
                      {children}
                    </Layout>
                  </SessionProvider>
                </ThemeProvider>
              </NextIntlClientProvider>
          </Suspense>
          </ErrorBoundary>
        </JotaiProvider>
        <Toaster />
      </body>
    </html>
  )
}

