import { describe, expect, test } from 'bun:test'
import {
  assessStartingAttributes,
  generateStarterProgram,
  getAttributeProgress,
  getCampaignState,
  normalizeAttributeScores,
  recommendAdaptation,
  type AssessmentResponses,
} from './progression'

const baseResponses: AssessmentResponses = {
  focusAreas: ['strength', 'focus'],
  baselines: {
    strength: 2,
    vitality: 3,
    focus: 2,
    wisdom: 4,
    discipline: 3,
    connection: 3,
  },
  consistency: 2,
  energy: 3,
  weekdayMinutes: 30,
  weekendMinutes: 45,
  preferredTime: 'morning',
  pace: 'balanced',
  motivation: 'visible_progress',
  restDays: [0],
  constraints: '',
}

describe('progression assessment', () => {
  test('scores every attribute within the editable 1-10 range', () => {
    const result = assessStartingAttributes(baseResponses)
    expect(Object.values(result.attributes)).toHaveLength(6)
    expect(Object.values(result.attributes).every(score => score >= 1 && score <= 10)).toBe(true)
    expect(result.attributes.strength).toBeGreaterThan(result.attributes.vitality - 2)
    expect(result.explanations.strength.length).toBeGreaterThanOrEqual(2)
  })

  test('normalizes edited and malformed scores', () => {
    expect(normalizeAttributeScores({ strength: 99, focus: -4 }).strength).toBe(10)
    expect(normalizeAttributeScores({ strength: 99, focus: -4 }).focus).toBe(1)
    expect(normalizeAttributeScores({}).wisdom).toBe(3)
  })

  test('generates a small editable program that respects rest days', () => {
    const program = generateStarterProgram(baseResponses)
    expect(program).toHaveLength(3)
    expect(program[0].primaryAttribute).toBe('strength')
    expect(program[0].frequency).not.toContain('SU')
    expect(program.every(item => item.reason.includes('/10'))).toBe(true)
  })
})

describe('attribute and campaign progression', () => {
  test('turns each 100 earned attribute XP into one level', () => {
    expect(getAttributeProgress('focus', 4, 245)).toMatchObject({ level: 6, currentXP: 45, pct: 45 })
  })

  test('divides the 66-day campaign into six eleven-day chapters', () => {
    expect(getCampaignState('2026-01-01', '2026-01-01')).toMatchObject({ day: 1, chapter: 1, chapterDay: 1 })
    expect(getCampaignState('2026-01-01', '2026-01-12')).toMatchObject({ day: 12, chapter: 2, chapterDay: 1 })
    expect(getCampaignState('2026-01-01', '2026-03-20').isContinuing).toBe(true)
  })
})

describe('adaptive difficulty', () => {
  test('waits for enough opportunities', () => {
    expect(recommendAdaptation({
      enabled: true, paused: false, opportunities: 4, completions: 4,
      tooEasy: 4, appropriate: 0, tooHard: 0, recentMisses: 0,
      currentLevel: 0, daysSinceLastChange: 10,
    }).action).toBe('hold')
  })

  test('increases only one step after consistent evidence', () => {
    expect(recommendAdaptation({
      enabled: true, paused: false, opportunities: 6, completions: 6,
      tooEasy: 2, appropriate: 4, tooHard: 0, recentMisses: 0,
      currentLevel: 0, daysSinceLastChange: 10,
    })).toMatchObject({ action: 'increase', nextLevel: 1 })
  })

  test('offers recovery after misses or hard feedback', () => {
    expect(recommendAdaptation({
      enabled: true, paused: false, opportunities: 7, completions: 2,
      tooEasy: 0, appropriate: 1, tooHard: 2, recentMisses: 3,
      currentLevel: 1, daysSinceLastChange: 10,
    })).toMatchObject({ action: 'recover', nextLevel: 0 })
  })

  test('honors disabled adaptation and cooldowns', () => {
    expect(recommendAdaptation({
      enabled: false, paused: false, opportunities: 10, completions: 10,
      tooEasy: 10, appropriate: 0, tooHard: 0, recentMisses: 0,
      currentLevel: 0, daysSinceLastChange: 10,
    }).action).toBe('hold')
    expect(recommendAdaptation({
      enabled: true, paused: false, opportunities: 10, completions: 10,
      tooEasy: 10, appropriate: 0, tooHard: 0, recentMisses: 0,
      currentLevel: 0, daysSinceLastChange: 2,
    }).action).toBe('hold')
  })
})
