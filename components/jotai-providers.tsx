'use client'

import React, { useRef } from 'react'
import { createStore, Provider } from 'jotai'

// Safety net: if Vercel's cache serves Jotai 2.8.x instead of 2.20.0, Jotai calls
// React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.assign on every render.
// React 19 removed this entirely, so we create it when absent.
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const R = React as any
  if (!R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = { assign: Object.assign }
  } else if (!R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.assign) {
    R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.assign = Object.assign
  }
} catch {}

import { settingsAtom, habitsAtom, coinsAtom, wishlistAtom, usersAtom, serverSettingsAtom } from '@/lib/atoms'
import { xpAtom, projectsAtom, bossAtom, guildDataAtom, petDataAtom } from '@/lib/gamification-atoms'
import { JotaiHydrateInitialValues } from '@/lib/types'

export const JotaiProvider = ({
  children,
  initialValues,
}: {
  children: React.ReactNode
  initialValues: JotaiHydrateInitialValues
}) => {
  const storeRef = useRef<ReturnType<typeof createStore> | null>(null)

  if (storeRef.current === null) {
    const store = createStore()
    store.set(settingsAtom, initialValues.settings)
    store.set(habitsAtom, initialValues.habits)
    store.set(coinsAtom, initialValues.coins)
    store.set(wishlistAtom, initialValues.wishlist)
    store.set(usersAtom, initialValues.users)
    store.set(serverSettingsAtom, initialValues.serverSettings)
    store.set(xpAtom, initialValues.xp)
    store.set(projectsAtom, initialValues.projects)
    store.set(bossAtom, initialValues.boss)
    store.set(guildDataAtom, initialValues.guild)
    store.set(petDataAtom, initialValues.pet)
    storeRef.current = store
  }

  return (
    <Provider store={storeRef.current}>
      {children}
    </Provider>
  )
}
