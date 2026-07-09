'use server'
import { Pet, PetData, PetForm, getDefaultPetData, XPData } from '@/lib/types'
import { v4 as uuid } from 'uuid'
import { getCurrentUser } from '@/lib/server-helpers'
import { getDb } from '@/lib/db'
import { pets } from '@/lib/db/schema'
import { petToWire, petToRow } from '@/lib/db/mappers'
import { eq } from 'drizzle-orm'
import { loadXPData, addGems } from './gamification'

const FORM_ORDER: PetForm[] = ['egg', 'hatchling', 'companion', 'guardian', 'legend']
const FORM_MAX_HP: Record<PetForm, number> = { egg: 50, hatchling: 80, companion: 120, guardian: 160, legend: 200 }
const FORM_XP_THRESHOLDS: Record<PetForm, number> = { egg: 100, hatchling: 300, companion: 700, guardian: 1500, legend: 9999999 }

function getMood(hp: number, maxHp: number): Pet['mood'] {
  const ratio = hp / maxHp
  if (ratio >= 0.8) return 'ecstatic'
  if (ratio >= 0.6) return 'happy'
  if (ratio >= 0.4) return 'neutral'
  if (ratio >= 0.2) return 'sad'
  return 'distressed'
}

function checkEvolution(pet: Pet): Pet {
  if (pet.form === 'legend') return pet
  if (pet.xp < pet.xpToNextForm) return pet
  const idx = FORM_ORDER.indexOf(pet.form)
  const nextForm = FORM_ORDER[idx + 1]
  const newMaxHp = FORM_MAX_HP[nextForm]
  return checkEvolution({
    ...pet,
    form: nextForm,
    hp: newMaxHp,
    maxHp: newMaxHp,
    xp: 0,
    xpToNextForm: FORM_XP_THRESHOLDS[nextForm],
    mood: 'ecstatic',
  })
}

async function savePetFor(userId: string, pet: Pet): Promise<void> {
  const db = await getDb()
  const row = petToRow(pet, userId)
  await db.insert(pets).values(row).onConflictDoUpdate({
    target: pets.userId,
    set: { ...row, userId: undefined } as Record<string, unknown>,
  })
}

export async function loadPetData(): Promise<PetData> {
  const user = await getCurrentUser()
  if (!user) return getDefaultPetData()
  const db = await getDb()
  const rows = await db.select().from(pets).where(eq(pets.userId, user.id)).limit(1)
  return { pet: rows[0] ? petToWire(rows[0]) : null }
}

export async function savePetData(data: PetData): Promise<void> {
  const user = await getCurrentUser()
  if (!user || !data.pet) return
  await savePetFor(user.id, data.pet)
}

export async function adoptPet(name: string): Promise<Pet> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const pet: Pet = {
    id: uuid(),
    name: name.trim() || 'Pip',
    form: 'egg',
    hp: 50,
    maxHp: 50,
    xp: 0,
    xpToNextForm: 100,
    mood: 'happy',
    adoptedAt: new Date().toISOString(),
  }
  await savePetFor(user.id, pet)
  return pet
}

export async function feedPet(gemCost: number): Promise<{ success: boolean; message: string; pet?: Pet; xpData?: XPData }> {
  const petData = await loadPetData()
  if (!petData.pet) return { success: false, message: 'No pet to feed' }

  const xpData = await loadXPData()
  const gems = xpData.gems ?? 0
  if (gems < gemCost) return { success: false, message: `Need ${gemCost} gems. You have ${gems}.` }

  const updatedXP = await addGems(-gemCost)

  const pet = petData.pet
  const newHp = Math.min(pet.maxHp, pet.hp + 20)
  const newXp = pet.xp + 50
  const evolved = checkEvolution({ ...pet, hp: newHp, mood: getMood(newHp, pet.maxHp), xp: newXp })
  evolved.lastFedAt = new Date().toISOString()
  await savePetData({ pet: evolved })
  return { success: true, message: 'Pet fed!', pet: evolved, xpData: updatedXP }
}

export async function applyDailyPetUpdate(vitalityPct: number): Promise<PetData> {
  const data = await loadPetData()
  if (!data.pet) return data
  let pet = data.pet
  if (vitalityPct >= 80) {
    pet = { ...pet, xp: pet.xp + 25 }
  } else if (vitalityPct < 50) {
    pet = { ...pet, hp: Math.max(0, pet.hp - 10) }
  }
  pet = { ...pet, mood: getMood(pet.hp, pet.maxHp) }
  pet = checkEvolution(pet)
  await savePetData({ pet })
  return { pet }
}
