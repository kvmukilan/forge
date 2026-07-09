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

// Monthly seasons generated deterministically from (year, month) — they roll
// forever with no data or maintenance. Twelve themes cycle by calendar month.
const SEASON_TEMPLATES: Array<Omit<Season, 'id' | 'number' | 'startDate' | 'endDate'>> = [
  { name: 'The Forge Awakens', emoji: '🔥', theme: 'New year, new fire. Every rep counts.', xpBonus: 10, coinBonus: 0 },
  { name: 'Shadow Protocol', emoji: '🌑', theme: 'Operate in the dark. Build in silence.', xpBonus: 5, coinBonus: 5 },
  { name: 'Storm Rising', emoji: '⛈️', theme: 'Momentum is a force of nature.', xpBonus: 0, coinBonus: 10 },
  { name: 'Bloom Directive', emoji: '🌸', theme: 'Growth is not optional.', xpBonus: 10, coinBonus: 0 },
  { name: 'Iron Bloom', emoji: '🌿', theme: 'Steady roots. Unbreakable form.', xpBonus: 5, coinBonus: 5 },
  { name: 'Solstice Surge', emoji: '☀️', theme: 'Longest days. Strongest habits.', xpBonus: 0, coinBonus: 10 },
  { name: 'The Golden Age', emoji: '✨', theme: 'Peak performance. Pure focus.', xpBonus: 10, coinBonus: 0 },
  { name: 'Ember Season', emoji: '🔶', theme: 'Slow burn beats hot flash.', xpBonus: 5, coinBonus: 5 },
  { name: 'Harvest Protocol', emoji: '🌾', theme: 'Reap what you logged.', xpBonus: 0, coinBonus: 10 },
  { name: 'Phantom Grind', emoji: '👻', theme: 'The habits nobody sees build the person everyone does.', xpBonus: 10, coinBonus: 0 },
  { name: 'Iron Resolve', emoji: '⚔️', theme: 'When it is hardest — that is when it counts.', xpBonus: 5, coinBonus: 5 },
  { name: 'Final Ascent', emoji: '🏔️', theme: 'Finish the year stronger than you started.', xpBonus: 10, coinBonus: 10 },
]

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function getSeasonForMonth(year: number, month: number): Season {
  const template = SEASON_TEMPLATES[(month - 1) % 12]
  // Season numbering starts at Jan 2025 = 1
  const number = (year - 2025) * 12 + month
  const mm = String(month).padStart(2, '0')
  return {
    id: `season-${year}-${mm}`,
    number,
    ...template,
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`,
  }
}

export function getCurrentSeason(now: Date = new Date()): Season {
  return getSeasonForMonth(now.getUTCFullYear(), now.getUTCMonth() + 1)
}

// Current season plus a window of past/future ones for the seasons page
export function getSeasonTimeline(pastCount = 3, futureCount = 2, now: Date = new Date()): Season[] {
  const seasons: Season[] = []
  for (let offset = -pastCount; offset <= futureCount; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    seasons.push(getSeasonForMonth(d.getUTCFullYear(), d.getUTCMonth() + 1))
  }
  return seasons
}

export function getDaysRemainingInSeason(season: Season): number {
  const end = new Date(`${season.endDate}T23:59:59Z`)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}
