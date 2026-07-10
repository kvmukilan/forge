'use client'

import { ReactNode, useEffect, useRef, useState, Suspense } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { aboutOpenAtom, pomodoroAtom, userSelectAtom, currentUserIdAtom, browserSettingsAtom, BrowserSettings } from '@/lib/atoms'
import PomodoroTimer from './PomodoroTimer'
import UserSelectModal from './UserSelectModal'
import CompleteWithNoteModal from './CompleteWithNoteModal'
import { useSession } from 'next-auth/react'
import AboutModal from './AboutModal'
import LoadingSpinner from './LoadingSpinner'

const BROWSER_SETTINGS_KEY = 'browserSettings'
// Reload data (full SSR hydration) when the tab comes back after being hidden this long
const STALE_AFTER_MS = 30 * 60 * 1000

function ClientWrapperContent({ children }: { children: ReactNode }) {
  const [pomo] = useAtom(pomodoroAtom)
  const [userSelect, setUserSelect] = useAtom(userSelectAtom)
  const [aboutOpen, setAboutOpen] = useAtom(aboutOpenAtom)
  const setCurrentUserIdAtom = useSetAtom(currentUserIdAtom)
  const { data: session, status } = useSession()
  const currentUserId = session?.user.id
  const [browserSettings, setBrowserSettings] = useAtom(browserSettingsAtom)
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    setCurrentUserIdAtom(currentUserId)
  }, [currentUserId, setCurrentUserIdAtom])

  // Load browser settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BROWSER_SETTINGS_KEY)
      if (stored) setBrowserSettings(JSON.parse(stored) as BrowserSettings)
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist browser settings to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(browserSettings))
    } catch {}
  }, [browserSettings])

  // Atoms are hydrated from the server on page load; if the tab was hidden for a
  // long time (common on mobile/PWA), reload to pick up fresh server state
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else if (hiddenAtRef.current && Date.now() - hiddenAtRef.current > STALE_AFTER_MS && status === 'authenticated') {
        window.location.reload()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [status])

  return (
    <>
      {children}
      {pomo.show && <PomodoroTimer />}
      <CompleteWithNoteModal />
      {userSelect && <UserSelectModal onClose={() => setUserSelect(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </>
  );
}

export default function ClientWrapper({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  // block client-side hydration until mounted (this is crucial to wait for all jotai atoms to load),
  // to prevent SSR hydration errors in the children components
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <LoadingSpinner />;
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ClientWrapperContent>{children}</ClientWrapperContent>
    </Suspense>
  );
}
