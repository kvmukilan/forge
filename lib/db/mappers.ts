import 'server-only'
import {
  Habit, WishlistItemType, CoinTransaction, User, Project, XPData, XPTransaction,
  Boss, Guild, Pet, TransactionType, XPTransactionSource, HabitCategory,
  getDefaultXPData,
} from '@/lib/types'
import { habits, completions, wishlistItems, coinTransactions, users, projects, xpState, xpTransactions, bosses, pets, guilds } from './schema'

type HabitRow = typeof habits.$inferSelect
type WishlistRow = typeof wishlistItems.$inferSelect
type CoinTxRow = typeof coinTransactions.$inferSelect
type UserRow = typeof users.$inferSelect
type ProjectRow = typeof projects.$inferSelect
type XPStateRow = typeof xpState.$inferSelect
type XPTxRow = typeof xpTransactions.$inferSelect
type BossRow = typeof bosses.$inferSelect
type PetRow = typeof pets.$inferSelect
type GuildRow = typeof guilds.$inferSelect
type CompletionRow = typeof completions.$inferSelect

// The wire format keeps `userIds: [ownerId]` so existing client filters
// (`x.userIds?.includes(user.id)`) continue to work over single-owner rows.
export function habitToWire(row: HabitRow, habitCompletions: CompletionRow[]): Habit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    frequency: row.frequency,
    coinReward: row.coinReward,
    ...(row.targetCompletions != null && { targetCompletions: row.targetCompletions }),
    completions: habitCompletions.map(c => c.completedAt).sort(),
    ...(row.isTask && { isTask: true }),
    ...(row.archived && { archived: true }),
    ...(row.pinned && { pinned: true }),
    userIds: [row.userId],
    ...(row.drawing != null && { drawing: row.drawing }),
    ...(row.difficulty != null && { difficulty: row.difficulty as Habit['difficulty'] }),
    ...(row.projectId != null && { projectId: row.projectId }),
    ...(row.priority != null && { priority: row.priority as Habit['priority'] }),
    ...(row.intentionWhen != null && { intentionWhen: row.intentionWhen }),
    ...(row.intentionWhere != null && { intentionWhere: row.intentionWhere }),
    ...(row.isKeystone && { isKeystone: true }),
    ...(row.category != null && { category: row.category as HabitCategory }),
    ...(row.primaryAttribute != null && { primaryAttribute: row.primaryAttribute as Habit['primaryAttribute'] }),
    ...(row.secondaryAttribute != null && { secondaryAttribute: row.secondaryAttribute as Habit['secondaryAttribute'] }),
    attributeReward: row.attributeReward,
    progressionOrigin: row.progressionOrigin as Habit['progressionOrigin'],
    adaptiveEnabled: row.adaptiveEnabled,
    adaptationLevel: row.adaptationLevel,
    ...(row.lastAdaptedAt != null && { lastAdaptedAt: row.lastAdaptedAt.toISOString() }),
    ...(row.pausedUntil != null && { pausedUntil: row.pausedUntil }),
    ...(row.estimatedMinutes != null && { estimatedMinutes: row.estimatedMinutes }),
    ...(row.recommendationReason != null && { recommendationReason: row.recommendationReason }),
  }
}

export function habitToRow(habit: Habit, ownerId: string): typeof habits.$inferInsert {
  return {
    id: habit.id,
    userId: habit.userIds?.[0] ?? ownerId,
    name: habit.name,
    description: habit.description ?? '',
    frequency: habit.frequency,
    coinReward: habit.coinReward ?? 1,
    targetCompletions: habit.targetCompletions ?? null,
    isTask: !!habit.isTask,
    archived: !!habit.archived,
    pinned: !!habit.pinned,
    drawing: habit.drawing ?? null,
    difficulty: habit.difficulty ?? null,
    projectId: habit.projectId ?? null,
    priority: habit.priority ?? null,
    intentionWhen: habit.intentionWhen ?? null,
    intentionWhere: habit.intentionWhere ?? null,
    isKeystone: !!habit.isKeystone,
    category: habit.category ?? null,
    primaryAttribute: habit.primaryAttribute ?? null,
    secondaryAttribute: habit.secondaryAttribute ?? null,
    attributeReward: habit.attributeReward ?? 10,
    progressionOrigin: habit.progressionOrigin ?? 'legacy',
    adaptiveEnabled: habit.adaptiveEnabled ?? true,
    adaptationLevel: habit.adaptationLevel ?? 0,
    lastAdaptedAt: habit.lastAdaptedAt ? new Date(habit.lastAdaptedAt) : null,
    pausedUntil: habit.pausedUntil ?? null,
    estimatedMinutes: habit.estimatedMinutes ?? null,
    recommendationReason: habit.recommendationReason ?? null,
  }
}

export function wishlistToWire(row: WishlistRow): WishlistItemType {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coinCost: row.coinCost,
    ...(row.archived && { archived: true }),
    ...(row.targetCompletions != null && { targetCompletions: row.targetCompletions }),
    ...(row.link != null && { link: row.link }),
    userIds: [row.userId],
    ...(row.drawing != null && { drawing: row.drawing }),
  }
}

export function wishlistToRow(item: WishlistItemType, ownerId: string): typeof wishlistItems.$inferInsert {
  return {
    id: item.id,
    userId: item.userIds?.[0] ?? ownerId,
    name: item.name,
    description: item.description ?? '',
    coinCost: item.coinCost ?? 1,
    archived: !!item.archived,
    targetCompletions: item.targetCompletions ?? null,
    link: item.link ?? null,
    drawing: item.drawing ?? null,
  }
}

export function coinTxToWire(row: CoinTxRow): CoinTransaction {
  return {
    id: row.id,
    amount: row.amount,
    type: row.type as TransactionType,
    description: row.description,
    timestamp: row.timestamp,
    ...(row.relatedItemId != null && { relatedItemId: row.relatedItemId }),
    ...(row.note != null && { note: row.note }),
    ...(row.eventKey != null && { eventKey: row.eventKey }),
    userId: row.userId,
  }
}

export function coinTxToRow(tx: CoinTransaction, fallbackUserId: string): typeof coinTransactions.$inferInsert {
  return {
    id: tx.id,
    userId: tx.userId ?? fallbackUserId,
    amount: tx.amount,
    type: tx.type,
    description: tx.description ?? '',
    timestamp: tx.timestamp,
    relatedItemId: tx.relatedItemId ?? null,
    note: tx.note ?? null,
    eventKey: tx.eventKey ?? null,
  }
}

export function userToWire(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    ...(row.password != null && { password: row.password }),
    ...(row.avatarPath != null && { avatarPath: row.avatarPath }),
    ...(row.permissions != null && { permissions: row.permissions as User['permissions'] }),
    isAdmin: row.isAdmin,
    ...(row.email != null && { email: row.email }),
    ...(row.oauthProvider != null && { oauthProvider: row.oauthProvider as 'google' }),
    ...(row.oauthId != null && { oauthId: row.oauthId }),
    ...(row.lastNotificationReadTimestamp != null && { lastNotificationReadTimestamp: row.lastNotificationReadTimestamp }),
  }
}

export function projectToWire(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    ...(row.emoji != null && { emoji: row.emoji }),
    userIds: [row.userId],
    createdAt: row.createdAt,
    ...(row.archived && { archived: true }),
  }
}

export function xpToWire(state: XPStateRow | undefined, txRows: XPTxRow[]): XPData {
  const base = getDefaultXPData()
  if (!state) return { ...base, transactions: txRows.map(xpTxToWire) }
  return {
    totalXP: state.totalXP,
    transactions: txRows.map(xpTxToWire),
    unlockedAchievements: state.unlockedAchievements as XPData['unlockedAchievements'],
    gems: state.gems,
    shields: state.shields,
    shieldUsedDates: state.shieldUsedDates as string[],
    perfectDays: state.perfectDays as string[],
    milestoneRewards: state.milestoneRewards as XPData['milestoneRewards'],
    activeBoosts: state.activeBoosts as XPData['activeBoosts'],
    activeTitle: state.activeTitle,
    equippedTitles: state.equippedTitles as string[],
    bossesDefeated: state.bossesDefeated,
    skillProgress: state.skillProgress as XPData['skillProgress'],
    unlockedSkills: state.unlockedSkills as string[],
  }
}

export function xpTxToWire(row: XPTxRow): XPTransaction {
  return {
    id: row.id,
    amount: row.amount,
    source: row.source as XPTransactionSource,
    ...(row.relatedItemId != null && { relatedItemId: row.relatedItemId }),
    timestamp: row.timestamp,
    ...(row.eventKey != null && { eventKey: row.eventKey }),
    userId: row.userId,
  }
}

export function xpStateToRow(data: XPData, userId: string): typeof xpState.$inferInsert {
  return {
    userId,
    totalXP: data.totalXP,
    gems: data.gems ?? 0,
    shields: data.shields ?? 0,
    shieldUsedDates: data.shieldUsedDates ?? [],
    perfectDays: data.perfectDays ?? [],
    milestoneRewards: data.milestoneRewards ?? [],
    activeBoosts: data.activeBoosts ?? [],
    unlockedAchievements: data.unlockedAchievements ?? [],
    activeTitle: data.activeTitle ?? null,
    equippedTitles: data.equippedTitles ?? [],
    bossesDefeated: data.bossesDefeated ?? 0,
    skillProgress: data.skillProgress ?? {},
    unlockedSkills: data.unlockedSkills ?? [],
  }
}

export function bossToWire(row: BossRow): Boss {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    weekStart: row.weekStart,
    maxHP: row.maxHP,
    currentHP: row.currentHP,
    isDefeated: row.isDefeated,
    rewardClaimed: row.rewardClaimed,
    reward: { xp: row.rewardXP, coins: row.rewardCoins },
  }
}

export function bossToRow(boss: Boss, userId: string): typeof bosses.$inferInsert {
  return {
    id: boss.id,
    userId,
    weekStart: boss.weekStart,
    name: boss.name,
    emoji: boss.emoji,
    maxHP: boss.maxHP,
    currentHP: boss.currentHP,
    isDefeated: boss.isDefeated,
    rewardClaimed: !!boss.rewardClaimed,
    rewardXP: boss.reward.xp,
    rewardCoins: boss.reward.coins,
  }
}

export function petToWire(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    form: row.form as Pet['form'],
    hp: row.hp,
    maxHp: row.maxHp,
    xp: row.xp,
    xpToNextForm: row.xpToNextForm,
    mood: row.mood as Pet['mood'],
    ...(row.lastFedAt != null && { lastFedAt: row.lastFedAt }),
    adoptedAt: row.adoptedAt,
  }
}

export function petToRow(pet: Pet, userId: string): typeof pets.$inferInsert {
  return {
    userId,
    id: pet.id,
    name: pet.name,
    form: pet.form,
    hp: pet.hp,
    maxHp: pet.maxHp,
    xp: pet.xp,
    xpToNextForm: pet.xpToNextForm,
    mood: pet.mood,
    lastFedAt: pet.lastFedAt ?? null,
    adoptedAt: pet.adoptedAt,
  }
}

export function guildToWire(row: GuildRow, memberIds: string[]): Guild {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    ...(row.description != null && { description: row.description }),
    inviteCode: row.inviteCode,
    memberIds,
    adminId: row.adminId,
    createdAt: row.createdAt,
  }
}
