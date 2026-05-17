'use server'
import fs from 'fs/promises'
import path from 'path'
import { Pet, PetData, PetForm, getDefaultPetData, XPData, getDefaultXPData } from '@/lib/types'
import { v4 as uuid } from 'uuid'

async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data')
  try { await fs.access(dataDir) } catch { await fs.mkdir(dataDir, { recursive: true }) }
}

async function readJSON<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDataDir()
  const filePath = path.join(process.cwd(), 'data', filename)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

async function writeJSON<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(process.cwd(), 'data', filename)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

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

export async function loadPetData(): Promise<PetData> {
  return readJSON('pet.json', getDefaultPetData())
}

export async function savePetData(data: PetData): Promise<void> {
  await writeJSON('pet.json', data)
}

export async function adoptPet(name: string): Promise<Pet> {
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
  await savePetData({ pet })
  return pet
}

export async function feedPet(gemCost: number): Promise<{ success: boolean; message: string; pet?: Pet; xpData?: XPData }> {
  const petData = await loadPetData()
  if (!petData.pet) return { success: false, message: 'No pet to feed' }

  const xpData: XPData = await readJSON('xp.json', getDefaultXPData())
  const gems = xpData.gems ?? 0
  if (gems < gemCost) return { success: false, message: `Need ${gemCost} gems. You have ${gems}.` }

  const updatedXP: XPData = { ...xpData, gems: gems - gemCost }
  await writeJSON('xp.json', updatedXP)

  const pet = petData.pet
  const newHp = Math.min(pet.maxHp, pet.hp + 20)
  const newXp = pet.xp + 50
  const evolved = checkEvolution({ ...pet, hp: newHp, mood: getMood(newHp, pet.maxHp), xp: newXp })
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
