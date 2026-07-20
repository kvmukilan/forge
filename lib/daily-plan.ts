import type { Habit } from './types'

export type EnergyLevel = 'low' | 'steady' | 'high'
export type DailyMood = 'drained' | 'okay' | 'good' | 'strong'

export const PLAN_CAPACITY: Record<EnergyLevel, number> = {
  low: 1,
  steady: 3,
  high: 5,
}

export const ENERGY_LABELS: Record<EnergyLevel, { label: string; description: string }> = {
  low: { label: 'Low', description: 'One meaningful win' },
  steady: { label: 'Steady', description: 'Three clear priorities' },
  high: { label: 'High', description: 'Up to five missions' },
}

export type PlanCandidate = Pick<
  Habit,
  'id' | 'name' | 'isTask' | 'isKeystone' | 'pinned' | 'priority' | 'difficulty' | 'coinReward'
>

export function scorePlanCandidate(candidate: PlanCandidate, energy: EnergyLevel): number {
  let score = 0

  if (candidate.isKeystone) score += 120
  if (candidate.pinned) score += 60
  if (candidate.isTask) score += 15

  if (candidate.priority === 'p1') score += 100
  else if (candidate.priority === 'p2') score += 50
  else if (candidate.priority === 'p3') score += 20

  const difficulty = candidate.difficulty ?? 'medium'
  if (energy === 'low') {
    score += difficulty === 'easy' ? 45 : difficulty === 'medium' ? 15 : -20
  } else if (energy === 'high') {
    score += difficulty === 'hard' ? 40 : difficulty === 'medium' ? 25 : 10
  } else {
    score += difficulty === 'medium' ? 30 : 20
  }

  // A tiny reward signal breaks otherwise-equal ties without letting game
  // currency outrank keystones or real task priority.
  score += Math.min(candidate.coinReward ?? 0, 20) / 10
  return score
}

export function buildSuggestedPlan<T extends PlanCandidate>(
  candidates: T[],
  energy: EnergyLevel,
): T[] {
  return [...candidates]
    .sort((a, b) => {
      const scoreDelta = scorePlanCandidate(b, energy) - scorePlanCandidate(a, energy)
      return scoreDelta || a.name.localeCompare(b.name)
    })
    .slice(0, PLAN_CAPACITY[energy])
}
