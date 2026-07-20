import { describe, expect, test } from 'bun:test'
import { buildSuggestedPlan, PLAN_CAPACITY, scorePlanCandidate, type PlanCandidate } from './daily-plan'

const candidate = (overrides: Partial<PlanCandidate>): PlanCandidate => ({
  id: overrides.id ?? 'habit',
  name: overrides.name ?? 'Habit',
  isTask: overrides.isTask ?? false,
  isKeystone: overrides.isKeystone ?? false,
  pinned: overrides.pinned ?? false,
  priority: overrides.priority,
  difficulty: overrides.difficulty ?? 'medium',
  coinReward: overrides.coinReward ?? 5,
})

describe('daily plan suggestions', () => {
  test('matches plan size to available energy', () => {
    const items = Array.from({ length: 7 }, (_, i) => candidate({ id: `${i}`, name: `Habit ${i}` }))

    expect(buildSuggestedPlan(items, 'low')).toHaveLength(PLAN_CAPACITY.low)
    expect(buildSuggestedPlan(items, 'steady')).toHaveLength(PLAN_CAPACITY.steady)
    expect(buildSuggestedPlan(items, 'high')).toHaveLength(PLAN_CAPACITY.high)
  })

  test('keystones outrank reward value', () => {
    const keystone = candidate({ id: 'keystone', isKeystone: true, coinReward: 1 })
    const lucrative = candidate({ id: 'lucrative', coinReward: 100 })

    expect(scorePlanCandidate(keystone, 'steady')).toBeGreaterThan(scorePlanCandidate(lucrative, 'steady'))
  })

  test('low energy favors a small easy action while high energy favors hard work', () => {
    const easy = candidate({ id: 'easy', name: 'Easy', difficulty: 'easy' })
    const hard = candidate({ id: 'hard', name: 'Hard', difficulty: 'hard' })

    expect(buildSuggestedPlan([hard, easy], 'low')[0].id).toBe('easy')
    expect(buildSuggestedPlan([easy, hard], 'high')[0].id).toBe('hard')
  })

  test('real task priority outranks difficulty matching', () => {
    const urgent = candidate({ id: 'urgent', name: 'Urgent', isTask: true, priority: 'p1', difficulty: 'hard' })
    const easy = candidate({ id: 'easy', name: 'Easy', difficulty: 'easy' })

    expect(buildSuggestedPlan([easy, urgent], 'low')[0].id).toBe('urgent')
  })
})
