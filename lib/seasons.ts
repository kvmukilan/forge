export interface Season {
  id: string
  number: number
  name: string
  emoji: string
  theme: string
  startDate: string
  endDate: string
  xpBonus: number
  coinBonus: number
}

export const SEASONS: Season[] = [
  { id: 'season-1', number: 1, name: 'The Forge Awakens', emoji: '🔥', theme: 'Master the basics. Every rep counts.', startDate: '2025-01-01', endDate: '2025-03-31', xpBonus: 0, coinBonus: 0 },
  { id: 'season-2', number: 2, name: 'Shadow Protocol', emoji: '🌑', theme: 'Operate in the dark. Build in silence.', startDate: '2025-04-01', endDate: '2025-06-30', xpBonus: 5, coinBonus: 0 },
  { id: 'season-3', number: 3, name: 'The Golden Age', emoji: '✨', theme: 'Peak performance. Pure focus.', startDate: '2025-07-01', endDate: '2025-09-30', xpBonus: 0, coinBonus: 10 },
  { id: 'season-4', number: 4, name: 'Iron Resolve', emoji: '⚔️', theme: 'When it is hardest — that is when it counts.', startDate: '2025-10-01', endDate: '2025-12-31', xpBonus: 10, coinBonus: 5 },
]

export function getCurrentSeason(): Season | null {
  const today = new Date().toISOString().slice(0, 10)
  return SEASONS.find(s => today >= s.startDate && today <= s.endDate) ?? null
}

export function getDaysRemainingInSeason(season: Season): number {
  const end = new Date(season.endDate)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}
