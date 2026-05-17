import { HabitCategory } from './types'

export interface SkillNode {
  id: string
  category: HabitCategory
  tier: 1 | 2 | 3
  name: string
  emoji: string
  description: string
  requiredCompletions: number
  xpBonusPct: number
  coinBonusPct: number
}

export const SKILL_NODES: SkillNode[] = [
  // Fitness
  { id: 'fitness-1', category: 'fitness', tier: 1, name: 'Iron Will', emoji: '💪', description: '10 fitness habits logged', requiredCompletions: 10, xpBonusPct: 5, coinBonusPct: 0 },
  { id: 'fitness-2', category: 'fitness', tier: 2, name: 'Warrior Body', emoji: '🏋️', description: '50 fitness habits logged', requiredCompletions: 50, xpBonusPct: 10, coinBonusPct: 5 },
  { id: 'fitness-3', category: 'fitness', tier: 3, name: 'Titan', emoji: '🦾', description: '100 fitness habits logged', requiredCompletions: 100, xpBonusPct: 20, coinBonusPct: 10 },
  // Learning
  { id: 'learning-1', category: 'learning', tier: 1, name: 'Apprentice', emoji: '📖', description: '10 learning habits logged', requiredCompletions: 10, xpBonusPct: 5, coinBonusPct: 0 },
  { id: 'learning-2', category: 'learning', tier: 2, name: 'Scholar', emoji: '🎓', description: '50 learning habits logged', requiredCompletions: 50, xpBonusPct: 10, coinBonusPct: 5 },
  { id: 'learning-3', category: 'learning', tier: 3, name: 'Sage', emoji: '🧠', description: '100 learning habits logged', requiredCompletions: 100, xpBonusPct: 20, coinBonusPct: 10 },
  // Mindfulness
  { id: 'mindfulness-1', category: 'mindfulness', tier: 1, name: 'Still Mind', emoji: '🧘', description: '10 mindfulness habits logged', requiredCompletions: 10, xpBonusPct: 5, coinBonusPct: 0 },
  { id: 'mindfulness-2', category: 'mindfulness', tier: 2, name: 'Inner Peace', emoji: '☮️', description: '50 mindfulness habits logged', requiredCompletions: 50, xpBonusPct: 10, coinBonusPct: 5 },
  { id: 'mindfulness-3', category: 'mindfulness', tier: 3, name: 'Enlightened', emoji: '✨', description: '100 mindfulness habits logged', requiredCompletions: 100, xpBonusPct: 20, coinBonusPct: 10 },
  // Social
  { id: 'social-1', category: 'social', tier: 1, name: 'Friend', emoji: '🤝', description: '10 social habits logged', requiredCompletions: 10, xpBonusPct: 5, coinBonusPct: 0 },
  { id: 'social-2', category: 'social', tier: 2, name: 'Connector', emoji: '🌐', description: '50 social habits logged', requiredCompletions: 50, xpBonusPct: 10, coinBonusPct: 5 },
  { id: 'social-3', category: 'social', tier: 3, name: 'Community Pillar', emoji: '👑', description: '100 social habits logged', requiredCompletions: 100, xpBonusPct: 20, coinBonusPct: 10 },
  // Creative
  { id: 'creative-1', category: 'creative', tier: 1, name: 'Creator', emoji: '🎨', description: '10 creative habits logged', requiredCompletions: 10, xpBonusPct: 5, coinBonusPct: 0 },
  { id: 'creative-2', category: 'creative', tier: 2, name: 'Artist', emoji: '🖌️', description: '50 creative habits logged', requiredCompletions: 50, xpBonusPct: 10, coinBonusPct: 5 },
  { id: 'creative-3', category: 'creative', tier: 3, name: 'Visionary', emoji: '🌟', description: '100 creative habits logged', requiredCompletions: 100, xpBonusPct: 20, coinBonusPct: 10 },
  // Productivity
  { id: 'productivity-1', category: 'productivity', tier: 1, name: 'Focused', emoji: '🎯', description: '10 productivity habits logged', requiredCompletions: 10, xpBonusPct: 5, coinBonusPct: 0 },
  { id: 'productivity-2', category: 'productivity', tier: 2, name: 'Optimizer', emoji: '⚡', description: '50 productivity habits logged', requiredCompletions: 50, xpBonusPct: 10, coinBonusPct: 5 },
  { id: 'productivity-3', category: 'productivity', tier: 3, name: 'Machine', emoji: '🤖', description: '100 productivity habits logged', requiredCompletions: 100, xpBonusPct: 20, coinBonusPct: 10 },
  // Health
  { id: 'health-1', category: 'health', tier: 1, name: 'Vitality', emoji: '🍎', description: '10 health habits logged', requiredCompletions: 10, xpBonusPct: 5, coinBonusPct: 0 },
  { id: 'health-2', category: 'health', tier: 2, name: 'Wellbeing', emoji: '💚', description: '50 health habits logged', requiredCompletions: 50, xpBonusPct: 10, coinBonusPct: 5 },
  { id: 'health-3', category: 'health', tier: 3, name: 'Longevity', emoji: '🌿', description: '100 health habits logged', requiredCompletions: 100, xpBonusPct: 20, coinBonusPct: 10 },
]

export function getSkillNodesForCategory(category: HabitCategory): SkillNode[] {
  return SKILL_NODES.filter(n => n.category === category).sort((a, b) => a.tier - b.tier)
}

export function getUnlockedBonusForCategory(category: HabitCategory, unlockedSkills: string[]): { xpBonusPct: number; coinBonusPct: number } {
  const nodes = getSkillNodesForCategory(category).filter(n => unlockedSkills.includes(n.id))
  if (nodes.length === 0) return { xpBonusPct: 0, coinBonusPct: 0 }
  const best = nodes[nodes.length - 1]
  return { xpBonusPct: best.xpBonusPct, coinBonusPct: best.coinBonusPct }
}
