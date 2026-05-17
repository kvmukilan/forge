import { RRule } from "rrule"
import { uuid } from "./utils"
import { DateTime } from "luxon"

export type UserId = string

export type Permission = {
  habit: {
    write: boolean
    interact: boolean
  }
  wishlist: {
    write: boolean
    interact: boolean
  }
  coins: {
    write: boolean
    interact: boolean
  }
}

export type SessionUser = {
  id: UserId
}

export type SafeUser = SessionUser & {
  username: string
  avatarPath?: string
  permissions?: Permission[]
  isAdmin?: boolean
  hasPassword?: boolean
}

export type User = SafeUser & {
  password?: string
  email?: string
  oauthProvider?: 'google'
  oauthId?: string
  lastNotificationReadTimestamp?: string
}

export type PublicUser = Omit<User, 'password'> & {
  hasPassword: boolean
}

export type HabitCategory = 'fitness' | 'learning' | 'mindfulness' | 'social' | 'creative' | 'productivity' | 'health' | 'other'

export type Habit = {
  id: string
  name: string
  description: string
  frequency: string
  coinReward: number
  targetCompletions?: number // Optional field, default to 1
  completions: string[] // Array of UTC ISO date strings
  isTask?: boolean // mark the habit as a task
  archived?: boolean // mark the habit as archived
  pinned?: boolean // mark the habit as pinned
  userIds?: UserId[]
  drawing?: string // Optional JSON string of drawing data
  difficulty?: 'easy' | 'medium' | 'hard'
  projectId?: string
  priority?: 'p1' | 'p2' | 'p3'
  intentionWhen?: string
  intentionWhere?: string
  isKeystone?: boolean
  category?: HabitCategory
}


export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type WishlistItemType = {
  id: string
  name: string
  description: string
  coinCost: number
  archived?: boolean // mark the wishlist item as archived
  targetCompletions?: number // Optional field, infinity when unset
  link?: string // Optional URL to external resource
  userIds?: UserId[]
  drawing?: string // Optional JSON string of drawing data
}

export type TransactionType = 'HABIT_COMPLETION' | 'HABIT_UNDO' | 'WISH_REDEMPTION' | 'MANUAL_ADJUSTMENT' | 'TASK_COMPLETION' | 'TASK_UNDO' | 'TASK_OVERDUE_PENALTY';

export interface CoinTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  timestamp: string;
  relatedItemId?: string;
  note?: string;
  userId?: UserId;
}

export interface UserData {
  users: User[]
}

export interface PublicUserData {
  users: PublicUser[]
}

export interface HabitsData {
  habits: Habit[];
}


export interface CoinsData {
  balance: number;
  transactions: CoinTransaction[];
}

// Default value functions
// Data container types
export interface WishlistData {
  items: WishlistItemType[];
}

// Default value functions
export const getDefaultUsersData = (): UserData => ({
  users: [
    {
      id: uuid(),
      username: 'admin',
      // password: '', // No default password for admin initially? Or set a secure default?
      isAdmin: true,
      lastNotificationReadTimestamp: undefined, // Initialize as undefined
    }
  ]
});

export const getDefaultPublicUsersData = (): PublicUserData => ({
  users: getDefaultUsersData().users.map(({ password, ...user }) => ({
    ...user,
    hasPassword: !!password,
  })),
});

export const getDefaultHabitsData = (): HabitsData => ({
  habits: []
});


export const getDefaultCoinsData = (): CoinsData => ({
  balance: 0,
  transactions: []
});

export const getDefaultWishlistData = (): WishlistData => ({
  items: []
});

export const getDefaultSettings = (): Settings => ({
  ui: {
    useNumberFormatting: true,
    useGrouping: true,
    notificationsEnabled: false,
    notificationTime: '08:00',
  },
  system: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekStartDay: 1, // Monday
    autoBackupEnabled: true, // Add this line (default to true)
    language: 'en', // Default language
  },
  profile: {}
});

export const getDefaultServerSettings = (): ServerSettings => ({
  isDemo: false
})

export type Project = {
  id: string
  name: string
  description: string
  color: string
  emoji?: string
  userIds?: UserId[]
  createdAt: string
  archived?: boolean
}

export interface ProjectsData {
  projects: Project[]
}

export type XPTransactionSource = 'HABIT_COMPLETION' | 'TASK_COMPLETION' | 'STREAK_BONUS' | 'DAILY_CHALLENGE' | 'MANUAL'

export type XPTransaction = {
  id: string
  amount: number
  source: XPTransactionSource
  relatedItemId?: string
  timestamp: string
  userId?: UserId
}

export interface XPBoost {
  type: 'xp_2x' | 'coins_2x' | 'gem_boost'
  expiresAt: string
}

export interface StreakMilestoneRecord {
  habitId: string
  milestone: number
  claimedAt: string
}

export interface XPData {
  totalXP: number
  transactions: XPTransaction[]
  unlockedAchievements: { id: string; unlockedAt: string }[]
  gems: number
  shields: number
  shieldUsedDates: string[]
  perfectDays: string[]
  milestoneRewards: StreakMilestoneRecord[]
  activeBoosts: XPBoost[]
  activeTitle: string | null
  equippedTitles: string[]
  bossesDefeated: number
  skillProgress?: Partial<Record<HabitCategory, number>>
  unlockedSkills?: string[]
}

export type Boss = {
  id: string
  name: string
  emoji: string
  weekStart: string
  maxHP: number
  currentHP: number
  isDefeated: boolean
  rewardClaimed?: boolean
  reward: { xp: number; coins: number }
}

export interface BossData {
  boss: Boss | null
}

export type Guild = {
  id: string
  name: string
  emoji: string
  description?: string
  inviteCode: string
  memberIds: UserId[]
  adminId: UserId
  createdAt: string
}

export type GuildQuestType = 'habit_blitz' | 'coin_surge' | 'boss_assault' | 'perfect_streak' | 'level_up_rush'
export type GuildQuestDifficulty = 'easy' | 'medium' | 'hard'

export interface GuildQuest {
  id: string
  guildId: string
  type: GuildQuestType
  difficulty: GuildQuestDifficulty
  title: string
  description: string
  emoji: string
  target: number
  weekStart: string
  reward: { coins: number; xp: number; gems: number }
  claimedBy: string[]
}

export interface GuildData {
  guilds: Guild[]
  quests: GuildQuest[]
}

export const getDefaultGuildData = (): GuildData => ({ guilds: [], quests: [] })

export type PetForm = 'egg' | 'hatchling' | 'companion' | 'guardian' | 'legend'

export type Pet = {
  id: string
  name: string
  form: PetForm
  hp: number
  maxHp: number
  xp: number
  xpToNextForm: number
  mood: 'ecstatic' | 'happy' | 'neutral' | 'sad' | 'distressed'
  lastFedAt?: string
  adoptedAt: string
}

export interface PetData {
  pet: Pet | null
}

export const getDefaultPetData = (): PetData => ({ pet: null })

export const getDefaultXPData = (): XPData => ({
  totalXP: 0,
  transactions: [],
  unlockedAchievements: [],
  gems: 0,
  shields: 0,
  shieldUsedDates: [],
  perfectDays: [],
  milestoneRewards: [],
  activeBoosts: [],
  activeTitle: null,
  equippedTitles: [],
  bossesDefeated: 0,
})
export const getDefaultProjectsData = (): ProjectsData => ({ projects: [] })
export const getDefaultBossData = (): BossData => ({ boss: null })

// Map of data types to their default values
export const DATA_DEFAULTS = {
  wishlist: getDefaultWishlistData,
  habits: getDefaultHabitsData,
  coins: getDefaultCoinsData,
  settings: getDefaultSettings,
  auth: getDefaultUsersData,
  xp: getDefaultXPData,
  projects: getDefaultProjectsData,
  boss: getDefaultBossData,
  guild: getDefaultGuildData,
} as const;

// Type for all possible data types
export type DataType = keyof typeof DATA_DEFAULTS;

export interface UISettings {
  useNumberFormatting: boolean;
  useGrouping: boolean;
  notificationsEnabled?: boolean;
  notificationTime?: string;
}

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday

export interface SystemSettings {
  timezone: string;
  weekStartDay: WeekDay;
  autoBackupEnabled: boolean; // Add this line
  language: string; // Add this line for language preference
}

export interface ProfileSettings {
  avatarPath?: string; // deprecated
}

export interface Settings {
  ui: UISettings;
  system: SystemSettings;
  profile: ProfileSettings;
}

export type CompletionCache = {
  [dateKey: string]: {  // dateKey format: "YYYY-MM-DD"
    [habitId: string]: number  // number of completions on that date
  }
}

export type ViewType = 'habits' | 'tasks'

export interface JotaiHydrateInitialValues {
  settings: Settings;
  coins: CoinsData;
  habits: HabitsData;
  wishlist: WishlistData;
  users: PublicUserData;
  serverSettings: ServerSettings;
  xp: XPData;
  projects: ProjectsData;
  boss: BossData;
  guild: GuildData;
  pet: PetData;
}

export interface ServerSettings {
  isDemo: boolean
}

export type ParsedResultType = DateTime<true> | RRule | string | null // null if invalid

// return rrule / datetime (machine-readable frequency), string (human-readable frequency), or null (invalid)
export interface ParsedFrequencyResult {
  message: string | null
  result: ParsedResultType
}
