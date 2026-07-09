import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  date,
  primaryKey,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

// --- Core ---

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password'), // salt:hash, null for OAuth-only accounts
  avatarPath: text('avatar_path'),
  permissions: jsonb('permissions'),
  isAdmin: boolean('is_admin').notNull().default(false),
  email: text('email'),
  oauthProvider: text('oauth_provider'),
  oauthId: text('oauth_id'),
  lastNotificationReadTimestamp: text('last_notification_read_timestamp'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('users_oauth_idx').on(t.oauthProvider, t.oauthId),
])

export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(), // Settings shape from lib/types.ts
})

export const avatars = pgTable('avatars', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mimeType: text('mime_type').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const habits = pgTable('habits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  frequency: text('frequency').notNull(),
  coinReward: integer('coin_reward').notNull().default(1),
  targetCompletions: integer('target_completions'),
  isTask: boolean('is_task').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  pinned: boolean('pinned').notNull().default(false),
  drawing: text('drawing'),
  difficulty: text('difficulty'),
  projectId: text('project_id'),
  priority: text('priority'),
  intentionWhen: text('intention_when'),
  intentionWhere: text('intention_where'),
  isKeystone: boolean('is_keystone').notNull().default(false),
  category: text('category'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('habits_user_idx').on(t.userId),
])

export const completions = pgTable('completions', {
  habitId: text('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  completedAt: text('completed_at').notNull(), // UTC ISO string, kept as text to round-trip exactly
  note: text('note'),
}, (t) => [
  primaryKey({ columns: [t.habitId, t.completedAt] }),
  index('completions_user_idx').on(t.userId, t.completedAt),
])

export const coinTransactions = pgTable('coin_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: text('type').notNull(),
  description: text('description').notNull().default(''),
  timestamp: text('timestamp').notNull(), // UTC ISO string (wire format)
  relatedItemId: text('related_item_id'),
  note: text('note'),
}, (t) => [
  index('coin_tx_user_idx').on(t.userId, t.timestamp),
])

export const wishlistItems = pgTable('wishlist_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  coinCost: integer('coin_cost').notNull().default(1),
  archived: boolean('archived').notNull().default(false),
  targetCompletions: integer('target_completions'),
  link: text('link'),
  drawing: text('drawing'),
}, (t) => [
  index('wishlist_user_idx').on(t.userId),
])

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  color: text('color').notNull().default('#FF4D00'),
  emoji: text('emoji'),
  archived: boolean('archived').notNull().default(false),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('projects_user_idx').on(t.userId),
])

// --- Gamification (all per-user) ---

export const xpState = pgTable('xp_state', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  totalXP: integer('total_xp').notNull().default(0),
  gems: integer('gems').notNull().default(0),
  shields: integer('shields').notNull().default(0),
  shieldUsedDates: jsonb('shield_used_dates').notNull().default([]),
  perfectDays: jsonb('perfect_days').notNull().default([]),
  milestoneRewards: jsonb('milestone_rewards').notNull().default([]),
  activeBoosts: jsonb('active_boosts').notNull().default([]),
  unlockedAchievements: jsonb('unlocked_achievements').notNull().default([]),
  activeTitle: text('active_title'),
  equippedTitles: jsonb('equipped_titles').notNull().default([]),
  bossesDefeated: integer('bosses_defeated').notNull().default(0),
  skillProgress: jsonb('skill_progress').notNull().default({}),
  unlockedSkills: jsonb('unlocked_skills').notNull().default([]),
})

export const xpTransactions = pgTable('xp_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  source: text('source').notNull(),
  relatedItemId: text('related_item_id'),
  timestamp: text('timestamp').notNull(),
}, (t) => [
  index('xp_tx_user_idx').on(t.userId, t.timestamp),
])

export const bosses = pgTable('bosses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStart: text('week_start').notNull(), // ISO date (Monday)
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  maxHP: integer('max_hp').notNull(),
  currentHP: integer('current_hp').notNull(),
  isDefeated: boolean('is_defeated').notNull().default(false),
  rewardClaimed: boolean('reward_claimed').notNull().default(false),
  rewardXP: integer('reward_xp').notNull(),
  rewardCoins: integer('reward_coins').notNull(),
}, (t) => [
  uniqueIndex('bosses_user_week_idx').on(t.userId, t.weekStart),
])

export const pets = pgTable('pets', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  name: text('name').notNull(),
  form: text('form').notNull(),
  hp: integer('hp').notNull(),
  maxHp: integer('max_hp').notNull(),
  xp: integer('xp').notNull().default(0),
  xpToNextForm: integer('xp_to_next_form').notNull(),
  mood: text('mood').notNull(),
  lastFedAt: text('last_fed_at'),
  adoptedAt: text('adopted_at').notNull(),
  lastDailyUpdate: date('last_daily_update'),
})

// --- Social ---

export const guilds = pgTable('guilds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  description: text('description'),
  inviteCode: text('invite_code').notNull().unique(),
  adminId: text('admin_id').notNull(),
  createdAt: text('created_at').notNull(),
})

export const guildMembers = pgTable('guild_members', {
  guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.guildId, t.userId] }),
  uniqueIndex('guild_members_user_idx').on(t.userId), // one guild per user
])

export const guildQuests = pgTable('guild_quests', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  difficulty: text('difficulty').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  emoji: text('emoji').notNull(),
  target: integer('target').notNull(),
  weekStart: text('week_start').notNull(),
  reward: jsonb('reward').notNull(), // { coins, xp, gems }
  claimedBy: jsonb('claimed_by').notNull().default([]),
}, (t) => [
  index('guild_quests_guild_week_idx').on(t.guildId, t.weekStart),
])

// --- Push notifications ---

export const pushSubscriptions = pgTable('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('push_subs_user_idx').on(t.userId),
])

export const pushLog = pgTable('push_log', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // 'reminder' | 'streak_risk' | ...
  sentOn: date('sent_on').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.kind, t.sentOn] }),
])

// --- Retention (Phase 3 features; tables created up-front to keep migrations linear) ---

export const loginClaims = pgTable('login_claims', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  claimDate: date('claim_date').notNull(),
  streakIndex: integer('streak_index').notNull(), // 1..7 position on the reward calendar
  reward: jsonb('reward').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.claimDate] }),
])

export const dailyQuests = pgTable('daily_quests', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questDate: date('quest_date').notNull(),
  questKey: text('quest_key').notNull(),
  target: integer('target').notNull(),
  claimed: boolean('claimed').notNull().default(false),
}, (t) => [
  primaryKey({ columns: [t.userId, t.questDate, t.questKey] }),
])

export const chestOpenings = pgTable('chest_openings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  reward: jsonb('reward').notNull(),
  openedAt: text('opened_at').notNull(),
})

export const leagueCohorts = pgTable('league_cohorts', {
  id: text('id').primaryKey(),
  weekStart: text('week_start').notNull(),
  tier: integer('tier').notNull(), // 1=Bronze .. 5=Ember
}, (t) => [
  index('league_cohorts_week_idx').on(t.weekStart),
])

export const leagueMembers = pgTable('league_members', {
  cohortId: text('cohort_id').notNull().references(() => leagueCohorts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  score: integer('score').notNull().default(0),
  result: text('result'), // 'promote' | 'stay' | 'demote' once the week closes
}, (t) => [
  primaryKey({ columns: [t.cohortId, t.userId] }),
])
