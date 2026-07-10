import type { HabitCategory } from './types'

// Starter habits for onboarding, framed around identity ("become someone who…")
export interface HabitTemplate {
  id: string
  name: string
  identity: string
  emoji: string
  category: HabitCategory
  difficulty: 'easy' | 'medium' | 'hard'
  coinReward: number
  description: string
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { id: 'walk', name: '10-minute walk', identity: 'moves every day', emoji: '🚶', category: 'fitness', difficulty: 'easy', coinReward: 5, description: 'A short walk, anywhere' },
  { id: 'workout', name: 'Work out', identity: 'is strong', emoji: '💪', category: 'fitness', difficulty: 'medium', coinReward: 10, description: 'Any training counts' },
  { id: 'water', name: 'Drink 8 glasses of water', identity: 'takes care of their body', emoji: '💧', category: 'health', difficulty: 'easy', coinReward: 5, description: 'Hydration first' },
  { id: 'sleep', name: 'In bed by 11pm', identity: 'protects their sleep', emoji: '😴', category: 'health', difficulty: 'medium', coinReward: 8, description: 'Screens down, lights out' },
  { id: 'read', name: 'Read 10 pages', identity: 'reads every day', emoji: '📖', category: 'learning', difficulty: 'easy', coinReward: 5, description: 'Any book counts' },
  { id: 'study', name: 'Study for 25 minutes', identity: 'is always learning', emoji: '🎓', category: 'learning', difficulty: 'medium', coinReward: 10, description: 'One focused pomodoro' },
  { id: 'meditate', name: 'Meditate 5 minutes', identity: 'stays calm under pressure', emoji: '🧘', category: 'mindfulness', difficulty: 'easy', coinReward: 5, description: 'Sit, breathe, notice' },
  { id: 'journal', name: 'Write 3 lines in a journal', identity: 'knows their own mind', emoji: '✍️', category: 'mindfulness', difficulty: 'easy', coinReward: 5, description: 'Three honest lines' },
  { id: 'deepwork', name: '1 hour of deep work', identity: 'does hard things', emoji: '🎯', category: 'productivity', difficulty: 'hard', coinReward: 15, description: 'No phone, no tabs' },
  { id: 'inboxzero', name: 'Clear the inbox', identity: 'stays on top of things', emoji: '📬', category: 'productivity', difficulty: 'medium', coinReward: 8, description: 'Every message triaged' },
  { id: 'reachout', name: 'Message someone you care about', identity: 'shows up for people', emoji: '💬', category: 'social', difficulty: 'easy', coinReward: 5, description: 'One genuine message' },
  { id: 'create', name: 'Create for 20 minutes', identity: 'makes things', emoji: '🎨', category: 'creative', difficulty: 'medium', coinReward: 10, description: 'Draw, write, build — anything' },
]
