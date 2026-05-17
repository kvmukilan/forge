'use client'

import { settingsAtom, habitsAtom, coinsAtom, wishlistAtom, usersAtom, serverSettingsAtom } from "@/lib/atoms"
import { xpAtom, projectsAtom, bossAtom, guildDataAtom, petDataAtom } from "@/lib/gamification-atoms"
import { useHydrateAtoms } from "jotai/utils"
import { JotaiHydrateInitialValues } from "@/lib/types"

export function JotaiHydrate({
  children,
  initialValues
}: { children: React.ReactNode, initialValues: JotaiHydrateInitialValues }) {
  useHydrateAtoms([
    [settingsAtom, initialValues.settings],
    [habitsAtom, initialValues.habits],
    [coinsAtom, initialValues.coins],
    [wishlistAtom, initialValues.wishlist],
    [usersAtom, initialValues.users],
    [serverSettingsAtom, initialValues.serverSettings],
    [xpAtom, initialValues.xp],
    [projectsAtom, initialValues.projects],
    [bossAtom, initialValues.boss],
    [guildDataAtom, initialValues.guild],
    [petDataAtom, initialValues.pet],
  ])
  return children
}
