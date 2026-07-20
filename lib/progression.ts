import { DateTime } from 'luxon'
import type { HabitCategory } from './types'

export const ATTRIBUTE_KEYS = [
  'strength',
  'vitality',
  'focus',
  'wisdom',
  'discipline',
  'connection',
] as const

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]
export type AttributeScores = Record<AttributeKey, number>
export type AttributeExplanations = Record<AttributeKey, string[]>
export type ProgressionPace = 'gentle' | 'balanced' | 'challenging'
export type PreferredTime = 'morning' | 'afternoon' | 'evening' | 'flexible'
export type EffortFeedback = 'too_easy' | 'right' | 'too_hard'

export interface AssessmentResponses {
  focusAreas: AttributeKey[]
  baselines: AttributeScores
  consistency: number
  energy: number
  weekdayMinutes: number
  weekendMinutes: number
  preferredTime: PreferredTime
  pace: ProgressionPace
  motivation: 'visible_progress' | 'rewards' | 'structure' | 'accountability'
  restDays: number[]
  constraints: string
}

export interface AssessmentResult {
  attributes: AttributeScores
  explanations: AttributeExplanations
}

export interface ProgramRecommendation {
  id: string
  name: string
  description: string
  frequency: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: HabitCategory
  primaryAttribute: AttributeKey
  secondaryAttribute: AttributeKey | null
  estimatedMinutes: number
  coinReward: number
  attributeReward: number
  reason: string
}

export interface AttributeProgress {
  key: AttributeKey
  base: number
  earnedXP: number
  level: number
  currentXP: number
  neededXP: number
  pct: number
}

export interface CampaignState {
  day: number
  chapter: number
  chapterDay: number
  chapterProgress: number
  isContinuing: boolean
}

export interface AdaptationEvidence {
  enabled: boolean
  paused: boolean
  opportunities: number
  completions: number
  tooEasy: number
  appropriate: number
  tooHard: number
  recentMisses: number
  currentLevel: number
  daysSinceLastChange: number
}

export interface AdaptationRecommendation {
  action: 'increase' | 'hold' | 'recover'
  nextLevel: number
  reason: string
}

export const DEFAULT_ATTRIBUTE_SCORES: AttributeScores = {
  strength: 3,
  vitality: 3,
  focus: 3,
  wisdom: 3,
  discipline: 3,
  connection: 3,
}

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  strength: 'Strength',
  vitality: 'Vitality',
  focus: 'Focus',
  wisdom: 'Wisdom',
  discipline: 'Discipline',
  connection: 'Connection',
}

export const ATTRIBUTE_DESCRIPTIONS: Record<AttributeKey, string> = {
  strength: 'Movement and physical training',
  vitality: 'Sleep, nutrition, recovery, and health maintenance',
  focus: 'Attention, planning, and distraction management',
  wisdom: 'Learning, reflection, and deliberate practice',
  discipline: 'Consistency, follow-through, and keeping commitments small',
  connection: 'Relationships, contribution, and community',
}

const CATEGORY_ATTRIBUTE_MAP: Record<HabitCategory, AttributeKey> = {
  fitness: 'strength',
  health: 'vitality',
  productivity: 'focus',
  learning: 'wisdom',
  mindfulness: 'discipline',
  social: 'connection',
  creative: 'wisdom',
  other: 'discipline',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function safeRating(value: number): number {
  return clamp(Math.round(Number.isFinite(value) ? value : 3), 1, 5)
}

export function normalizeAttributeScores(scores: Partial<AttributeScores>): AttributeScores {
  return Object.fromEntries(ATTRIBUTE_KEYS.map(key => [
    key,
    clamp(Math.round(scores[key] ?? DEFAULT_ATTRIBUTE_SCORES[key]), 1, 10),
  ])) as AttributeScores
}

export function assessStartingAttributes(responses: AssessmentResponses): AssessmentResult {
  const focusAreas = new Set(responses.focusAreas)
  const explanations: AttributeExplanations = {
    strength: [],
    vitality: [],
    focus: [],
    wisdom: [],
    discipline: [],
    connection: [],
  }
  const scores = {} as AttributeScores

  for (const key of ATTRIBUTE_KEYS) {
    const baseline = safeRating(responses.baselines[key])
    let score = 2 + (baseline - 1) * 1.5
    explanations[key].push(`Your current ${ATTRIBUTE_LABELS[key].toLowerCase()} routine was rated ${baseline} of 5.`)

    if (focusAreas.has(key)) {
      score += 1
      explanations[key].push('You selected this as an area you want to develop.')
    }

    if (key === 'discipline') {
      const consistency = safeRating(responses.consistency)
      score += (consistency - 3) * 0.5
      explanations[key].push(`Your recent follow-through was rated ${consistency} of 5.`)
    }

    if (key === 'vitality') {
      const energy = safeRating(responses.energy)
      score += (energy - 3) * 0.5
      explanations[key].push(`Your typical energy was rated ${energy} of 5.`)
    }

    scores[key] = clamp(Math.round(score), 1, 10)
  }

  return { attributes: scores, explanations }
}

export function getPrimaryAttributeForCategory(category?: HabitCategory | null): AttributeKey {
  return CATEGORY_ATTRIBUTE_MAP[category ?? 'other']
}

export function getAttributeRewardForDifficulty(difficulty?: 'easy' | 'medium' | 'hard' | null): number {
  if (difficulty === 'hard') return 22
  if (difficulty === 'medium') return 15
  return 10
}

const PROGRAM_TEMPLATES: Record<AttributeKey, Omit<ProgramRecommendation, 'frequency' | 'difficulty' | 'coinReward' | 'attributeReward' | 'estimatedMinutes' | 'reason'>> = {
  strength: {
    id: 'starter-strength',
    name: 'Movement primer',
    description: 'A short walk, mobility flow, or bodyweight session. Stop while another session still feels possible.',
    category: 'fitness',
    primaryAttribute: 'strength',
    secondaryAttribute: 'vitality',
  },
  vitality: {
    id: 'starter-vitality',
    name: 'Recovery check-in',
    description: 'Protect one recovery action: hydration, a consistent bedtime, nutritious food, or deliberate rest.',
    category: 'health',
    primaryAttribute: 'vitality',
    secondaryAttribute: 'discipline',
  },
  focus: {
    id: 'starter-focus',
    name: 'Single-focus block',
    description: 'Choose one meaningful task, silence avoidable distractions, and work only on that task.',
    category: 'productivity',
    primaryAttribute: 'focus',
    secondaryAttribute: 'discipline',
  },
  wisdom: {
    id: 'starter-wisdom',
    name: 'Learn and capture',
    description: 'Read, study, or practice something useful, then write one sentence about what changed in your thinking.',
    category: 'learning',
    primaryAttribute: 'wisdom',
    secondaryAttribute: 'focus',
  },
  discipline: {
    id: 'starter-discipline',
    name: 'Keep one small promise',
    description: 'Complete a deliberately small action at the time and place you chose. Consistency matters more than intensity.',
    category: 'mindfulness',
    primaryAttribute: 'discipline',
    secondaryAttribute: null,
  },
  connection: {
    id: 'starter-connection',
    name: 'Meaningful reach-out',
    description: 'Send one genuine message, offer help, or spend a few undistracted minutes with someone important.',
    category: 'social',
    primaryAttribute: 'connection',
    secondaryAttribute: 'vitality',
  },
}

function getActiveDayRule(restDays: number[]): string {
  const normalizedRestDays = new Set(restDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))
  if (normalizedRestDays.size === 0) return 'FREQ=DAILY'
  const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
  const activeDays = dayCodes.filter((_, day) => !normalizedRestDays.has(day))
  if (activeDays.length === 0) return 'FREQ=WEEKLY;BYDAY=MO'
  return `FREQ=WEEKLY;BYDAY=${activeDays.join(',')}`
}

export function generateStarterProgram(responses: AssessmentResponses): ProgramRecommendation[] {
  const result = assessStartingAttributes(responses)
  const focusAreas = [...new Set(responses.focusAreas)]
  const fallback: AttributeKey[] = ['discipline', 'vitality', 'focus']
  const chosen = [...focusAreas, ...fallback.filter(key => !focusAreas.includes(key))].slice(0, 3)
  const capacity = Math.max(5, Math.round(responses.weekdayMinutes / Math.max(chosen.length, 1)))
  const frequency = getActiveDayRule(responses.restDays)

  return chosen.map((key, index) => {
    const template = PROGRAM_TEMPLATES[key]
    const assessed = result.attributes[key]
    const difficulty: ProgramRecommendation['difficulty'] = responses.pace === 'gentle'
      ? 'easy'
      : responses.pace === 'challenging' && assessed >= 6 && index === 0
        ? 'hard'
        : assessed >= 5
          ? 'medium'
          : 'easy'
    const estimatedMinutes = clamp(
      difficulty === 'hard' ? capacity : difficulty === 'medium' ? Math.min(capacity, 25) : Math.min(capacity, 10),
      5,
      60,
    )
    const attributeReward = getAttributeRewardForDifficulty(difficulty)

    return {
      ...template,
      frequency,
      difficulty,
      estimatedMinutes,
      coinReward: difficulty === 'hard' ? 15 : difficulty === 'medium' ? 10 : 5,
      attributeReward,
      reason: `Builds ${ATTRIBUTE_LABELS[key]} from your ${result.attributes[key]}/10 starting estimate in about ${estimatedMinutes} minutes.`,
    }
  })
}

export function getAttributeProgress(key: AttributeKey, base: number, earnedXP: number): AttributeProgress {
  const safeBase = clamp(Math.round(base), 1, 10)
  const safeXP = Math.max(0, Math.round(earnedXP))
  const levelGain = Math.floor(safeXP / 100)
  const currentXP = safeXP % 100
  return {
    key,
    base: safeBase,
    earnedXP: safeXP,
    level: safeBase + levelGain,
    currentXP,
    neededXP: 100,
    pct: currentXP,
  }
}

export function getCampaignState(startedOn: string | null | undefined, todayISO?: string): CampaignState {
  if (!startedOn) return { day: 0, chapter: 0, chapterDay: 0, chapterProgress: 0, isContinuing: false }
  const start = DateTime.fromISO(startedOn).startOf('day')
  const today = DateTime.fromISO(todayISO ?? DateTime.now().toISODate()!).startOf('day')
  if (!start.isValid || !today.isValid || today < start) {
    return { day: 1, chapter: 1, chapterDay: 1, chapterProgress: 9, isContinuing: false }
  }
  const day = Math.floor(today.diff(start, 'days').days) + 1
  const cappedDay = Math.min(day, 66)
  const chapter = Math.ceil(cappedDay / 11)
  const chapterDay = ((cappedDay - 1) % 11) + 1
  return {
    day,
    chapter,
    chapterDay,
    chapterProgress: Math.round((chapterDay / 11) * 100),
    isContinuing: day > 66,
  }
}

export function getRankForLevel(level: number): { name: string; nextAt: number | null } {
  if (level >= 40) return { name: 'Paragon', nextAt: null }
  if (level >= 25) return { name: 'Ascendant', nextAt: 40 }
  if (level >= 15) return { name: 'Vanguard', nextAt: 25 }
  if (level >= 5) return { name: 'Pathfinder', nextAt: 15 }
  return { name: 'Initiate', nextAt: 5 }
}

export function recommendAdaptation(evidence: AdaptationEvidence): AdaptationRecommendation {
  const currentLevel = clamp(Math.round(evidence.currentLevel), -2, 2)
  if (!evidence.enabled) return { action: 'hold', nextLevel: currentLevel, reason: 'Adaptive recommendations are turned off.' }
  if (evidence.paused) return { action: 'hold', nextLevel: currentLevel, reason: 'This quest is paused.' }
  if (evidence.daysSinceLastChange < 7) return { action: 'hold', nextLevel: currentLevel, reason: 'A recent change needs more time before another adjustment.' }
  if (evidence.opportunities < 5) return { action: 'hold', nextLevel: currentLevel, reason: 'Complete a few more scheduled attempts before changing the challenge.' }

  const adherence = evidence.completions / Math.max(evidence.opportunities, 1)
  const struggling = adherence < 0.5 || evidence.tooHard >= 2 || evidence.recentMisses >= 3
  if (struggling) {
    if (currentLevel <= -2) return { action: 'hold', nextLevel: currentLevel, reason: 'Keep the minimum version while momentum recovers.' }
    return { action: 'recover', nextLevel: currentLevel - 1, reason: 'Recent results suggest a smaller version will protect momentum.' }
  }

  const ready = adherence >= 0.8 && evidence.tooHard === 0 && (evidence.tooEasy > 0 || evidence.appropriate >= 3)
  if (ready) {
    if (currentLevel >= 2) return { action: 'hold', nextLevel: currentLevel, reason: 'This quest is already at its current safe ceiling.' }
    return { action: 'increase', nextLevel: currentLevel + 1, reason: 'Consistent completion shows room for one small progression step.' }
  }

  return { action: 'hold', nextLevel: currentLevel, reason: 'The current challenge is in a useful range.' }
}
