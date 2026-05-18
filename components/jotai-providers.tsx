'use client'

import React, { useRef } from 'react'
import { createStore, Provider } from 'jotai'
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
