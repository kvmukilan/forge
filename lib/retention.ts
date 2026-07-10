// Shared constants for the retention systems (importable from client and server)

export interface LoginReward {
  coins?: number
  gems?: number
  chest?: boolean
}

export const LOGIN_REWARDS: LoginReward[] = [
  { coins: 10 },
  { coins: 15 },
  { gems: 1 },
  { coins: 25 },
  { gems: 2 },
  { coins: 40 },
  { chest: true },
]

export const LEAGUE_TIERS = ['Bronze', 'Silver', 'Gold', 'Obsidian', 'Ember'] as const
