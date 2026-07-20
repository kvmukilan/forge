'use server'

import fs from 'fs/promises'
import path from 'path'
import {
  HabitsData,
  CoinsData,
  CoinTransaction,
  TransactionType,
  WishlistData,
  Settings,
  getDefaultSettings,
  UserData,
  User,
  PublicUser,
  PublicUserData,
  getDefaultWishlistData,
  getDefaultHabitsData,
  getDefaultCoinsData,
  Permission,
  ServerSettings
} from '@/lib/types'
import { d2t, getNow, uuid } from '@/lib/utils';
import { verifyPassword, saltAndHashPassword, getCurrentUser } from "@/lib/server-helpers";
import { signInSchema, signUpSchema } from '@/lib/zod';
import { sanitizeUserData } from '@/lib/user-sanitizer'
import { ALLOWED_AVATAR_EXTENSIONS, ALLOWED_AVATAR_MIME_TYPES } from '@/lib/avatar'
import { PermissionError } from '@/lib/exceptions'
import { getDb } from '@/lib/db'
import { habits, completions, wishlistItems, coinTransactions, users, userSettings, avatars } from '@/lib/db/schema'
import { habitToWire, habitToRow, wishlistToWire, wishlistToRow, coinTxToWire, coinTxToRow, userToWire } from '@/lib/db/mappers'
import { and, eq, desc, inArray, sql } from 'drizzle-orm'

type ResourceType = 'habit' | 'wishlist' | 'coins'
type ActionType = 'write' | 'interact'

const DEFAULT_SELF_PERMISSIONS: Permission[] = [{
  habit: { write: true, interact: true },
  wishlist: { write: true, interact: true },
  coins: { write: true, interact: true },
}]

// Row-level ownership is enforced by the user-scoped queries below; this guards
// that a session exists at all before any mutation.
async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new PermissionError('User not authenticated')
  return user
}

async function verifyPermission(
  _resource: ResourceType,
  _action: ActionType
): Promise<User> {
  return requireUser()
}

// Wishlist specific functions
export async function loadWishlistData(): Promise<WishlistData> {
  const user = await getCurrentUser()
  if (!user) return getDefaultWishlistData()
  const db = await getDb()
  const rows = user.isAdmin
    ? await db.select().from(wishlistItems)
    : await db.select().from(wishlistItems).where(eq(wishlistItems.userId, user.id))
  return { items: rows.map(wishlistToWire) }
}

export async function loadWishlistItems() {
  const data = await loadWishlistData()
  return data.items
}

export async function saveWishlistItems(data: WishlistData): Promise<void> {
  const user = await verifyPermission('wishlist', 'write')
  const db = await getDb()

  const rows = data.items.map(item => wishlistToRow(item, user.id))
  const keptIds = rows.map(r => r.id)

  // Delete this user's items absent from the payload (admins round-trip the full set)
  const scope = user.isAdmin ? undefined : eq(wishlistItems.userId, user.id)
  const existing = scope
    ? await db.select({ id: wishlistItems.id }).from(wishlistItems).where(scope)
    : await db.select({ id: wishlistItems.id }).from(wishlistItems)
  const toDelete = existing.map(r => r.id).filter(id => !keptIds.includes(id))
  if (toDelete.length > 0) {
    await db.delete(wishlistItems).where(inArray(wishlistItems.id, toDelete))
  }

  for (const row of rows) {
    await db.insert(wishlistItems).values(row).onConflictDoUpdate({
      target: wishlistItems.id,
      set: { ...row, userId: undefined, id: undefined } as Record<string, unknown>,
    })
  }
}

// Habits specific functions
export async function loadHabitsData(): Promise<HabitsData> {
  const user = await getCurrentUser()
  if (!user) return getDefaultHabitsData()
  const db = await getDb()
  const scope = user.isAdmin ? undefined : eq(habits.userId, user.id)
  const habitRows = scope
    ? await db.select().from(habits).where(scope)
    : await db.select().from(habits)
  const habitIds = habitRows.map(h => h.id)
  const completionRows = habitIds.length > 0
    ? await db.select().from(completions).where(inArray(completions.habitId, habitIds))
    : []
  const byHabit = new Map<string, typeof completionRows>()
  for (const c of completionRows) {
    const list = byHabit.get(c.habitId) ?? []
    list.push(c)
    byHabit.set(c.habitId, list)
  }
  return { habits: habitRows.map(h => habitToWire(h, byHabit.get(h.id) ?? [])) }
}

export async function saveHabitsData(data: HabitsData): Promise<void> {
  const user = await verifyPermission('habit', 'write')
  const db = await getDb()

  const keptIds = data.habits.map(h => h.id)
  const scope = user.isAdmin ? undefined : eq(habits.userId, user.id)
  const existing = scope
    ? await db.select({ id: habits.id }).from(habits).where(scope)
    : await db.select({ id: habits.id }).from(habits)
  const toDelete = existing.map(r => r.id).filter(id => !keptIds.includes(id))
  if (toDelete.length > 0) {
    await db.delete(habits).where(inArray(habits.id, toDelete))
  }

  for (const habit of data.habits) {
    const row = habitToRow(habit, user.id)
    await db.insert(habits).values(row).onConflictDoUpdate({
      target: habits.id,
      // Never reassign ownership on update
      set: { ...row, userId: undefined, id: undefined } as Record<string, unknown>,
    })

    // Sync completions: the wire format is an array of UTC ISO strings
    const existingCompletions = await db.select().from(completions).where(eq(completions.habitId, habit.id))
    const existingSet = new Set(existingCompletions.map(c => c.completedAt))
    const newSet = new Set(habit.completions ?? [])
    const toInsert = [...newSet].filter(ts => !existingSet.has(ts))
    const toRemove = [...existingSet].filter(ts => !newSet.has(ts))
    if (toRemove.length > 0) {
      await db.delete(completions).where(and(eq(completions.habitId, habit.id), inArray(completions.completedAt, toRemove)))
    }
    if (toInsert.length > 0) {
      await db.insert(completions).values(toInsert.map(ts => ({
        habitId: habit.id,
        userId: row.userId,
        completedAt: ts,
      }))).onConflictDoNothing()
    }
  }
}

// Attaches a note to an existing completion (identified by its exact UTC ISO timestamp)
export async function setCompletionNote(habitId: string, completedAt: string, note: string): Promise<void> {
  const user = await requireUser()
  const db = await getDb()
  const scope = user.isAdmin
    ? and(eq(completions.habitId, habitId), eq(completions.completedAt, completedAt))
    : and(eq(completions.habitId, habitId), eq(completions.completedAt, completedAt), eq(completions.userId, user.id))
  await db.update(completions).set({ note: note.trim() || null }).where(scope)
}

// Notes for one habit keyed by completion timestamp (for calendar/detail views)
export async function getCompletionNotes(habitId: string): Promise<Record<string, string>> {
  const user = await getCurrentUser()
  if (!user) return {}
  const db = await getDb()
  const scope = user.isAdmin
    ? eq(completions.habitId, habitId)
    : and(eq(completions.habitId, habitId), eq(completions.userId, user.id))
  const rows = await db.select().from(completions).where(scope)
  const notes: Record<string, string> = {}
  for (const row of rows) {
    if (row.note) notes[row.completedAt] = row.note
  }
  return notes
}

// Coins specific functions
export async function loadCoinsData(): Promise<CoinsData> {
  const user = await getCurrentUser()
  if (!user) return getDefaultCoinsData()
  const db = await getDb()
  const scope = user.isAdmin ? undefined : eq(coinTransactions.userId, user.id)
  const rows = scope
    ? await db.select().from(coinTransactions).where(scope).orderBy(desc(coinTransactions.timestamp))
    : await db.select().from(coinTransactions).orderBy(desc(coinTransactions.timestamp))
  const balance = rows.reduce((sum, r) => sum + r.amount, 0)
  return { balance, transactions: rows.map(coinTxToWire) }
}

export async function saveCoinsData(data: CoinsData): Promise<void> {
  const user = await requireUser()
  const db = await getDb()

  // Append-only sync: insert transactions we don't have yet, remove the user's
  // transactions absent from the payload (undo removes a transaction client-side)
  const payloadIds = data.transactions.map(t => t.id)
  const scope = user.isAdmin ? undefined : eq(coinTransactions.userId, user.id)
  const existing = scope
    ? await db.select({ id: coinTransactions.id }).from(coinTransactions).where(scope)
    : await db.select({ id: coinTransactions.id }).from(coinTransactions)
  const existingIds = new Set(existing.map(r => r.id))
  const toDelete = [...existingIds].filter(id => !payloadIds.includes(id))
  if (toDelete.length > 0) {
    await db.delete(coinTransactions).where(inArray(coinTransactions.id, toDelete))
  }
  const toInsert = data.transactions.filter(t => !existingIds.has(t.id))
  if (toInsert.length > 0) {
    await db.insert(coinTransactions).values(toInsert.map(t => coinTxToRow(t, user.id))).onConflictDoNothing()
  }
}

export async function addCoins({
  amount,
  description,
  type = 'MANUAL_ADJUSTMENT',
  relatedItemId,
  note,
  userId,
  eventKey,
}: {
  amount: number
  description: string
  type?: TransactionType
  relatedItemId?: string
  note?: string
  userId?: string
  eventKey?: string
}): Promise<CoinsData> {
  const currentUser = await verifyPermission('coins', type === 'MANUAL_ADJUSTMENT' ? 'write' : 'interact')
  const db = await getDb()
  const newTransaction: CoinTransaction = {
    id: uuid(),
    amount,
    type,
    description,
    timestamp: d2t({ dateTime: getNow({}) }),
    ...(relatedItemId && { relatedItemId }),
    ...(note && note.trim() !== '' && { note }),
    ...(eventKey && { eventKey }),
    userId: userId || currentUser.id
  }
  await db.insert(coinTransactions).values(coinTxToRow(newTransaction, currentUser.id)).onConflictDoNothing()
  return loadCoinsData()
}

export async function removeCoins({
  amount,
  description,
  type = 'MANUAL_ADJUSTMENT',
  relatedItemId,
  note,
  userId,
  eventKey,
}: {
  amount: number
  description: string
  type?: TransactionType
  relatedItemId?: string
  note?: string
  userId?: string
  eventKey?: string
}): Promise<CoinsData> {
  return addCoins({ amount: -amount, description, type, relatedItemId, note, userId, eventKey })
}

export async function reverseCoinReward({
  originalEventKey,
  undoEventKey,
  description,
  type,
}: {
  originalEventKey: string
  undoEventKey: string
  description: string
  type: Extract<TransactionType, 'HABIT_UNDO' | 'TASK_UNDO'>
}): Promise<CoinsData> {
  const user = await requireUser()
  const db = await getDb()
  const [original] = await db.select().from(coinTransactions).where(and(
    eq(coinTransactions.userId, user.id),
    eq(coinTransactions.eventKey, originalEventKey),
  )).limit(1)
  if (!original) return loadCoinsData()
  return addCoins({
    amount: -original.amount,
    description,
    type,
    relatedItemId: original.relatedItemId ?? undefined,
    eventKey: undoEventKey,
  })
}

export async function loadSettings(): Promise<Settings> {
  const defaultSettings = getDefaultSettings()
  try {
    const user = await getCurrentUser()
    if (!user) return defaultSettings
    const db = await getDb()
    const rows = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1)
    if (!rows[0]) return defaultSettings
    return { ...defaultSettings, ...(rows[0].data as Settings) }
  } catch {
    return defaultSettings
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const user = await requireUser()
  const db = await getDb()
  await db.insert(userSettings).values({ userId: user.id, data: settings }).onConflictDoUpdate({
    target: userSettings.userId,
    set: { data: settings },
  })
}

export async function uploadAvatar(formData: FormData): Promise<string> {
  const user = await requireUser()
  const file = formData.get('avatar') as File
  if (!file) throw new Error('No file provided')

  if (file.size > 5 * 1024 * 1024) { // 5MB
    throw new Error('File size must be less than 5MB')
  }

  const mimeType = file.type.toLowerCase()
  if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported avatar MIME type')
  }

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
    throw new Error('Unsupported avatar file extension')
  }

  const id = uuid()
  const buffer = Buffer.from(await file.arrayBuffer())
  const db = await getDb()
  await db.insert(avatars).values({ id, userId: user.id, mimeType, data: buffer })

  // Convention consumed by the UI: last path segment is requested at /api/avatars/<segment>
  return `/data/avatars/${id}${ext}`
}

export async function getChangelog(): Promise<string> {
  try {
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md')
    return await fs.readFile(changelogPath, 'utf8')
  } catch (error) {
    console.error('Error loading changelog:', error)
    return '# Changelog\n\nNo changelog available.'
  }
}

// user logic
async function loadUsersData(): Promise<UserData> {
  const db = await getDb()
  const rows = await db.select().from(users)
  return { users: rows.map(userToWire) }
}

export async function loadUsersPublicData(): Promise<PublicUserData> {
  // The account directory supports sharing and admin tools after sign-in. It
  // must not be embedded in the public login page's hydration payload.
  const viewer = await getCurrentUser()
  if (!viewer) return { users: [] }
  const data = await loadUsersData()
  return sanitizeUserData(data)
}

export async function findOrCreateOAuthUser(oauthId: string, provider: 'google', email?: string, name?: string): Promise<User | null> {
  const db = await getDb()

  // Find by oauthId + provider
  const byOauth = await db.select().from(users)
    .where(and(eq(users.oauthId, oauthId), eq(users.oauthProvider, provider))).limit(1)
  if (byOauth[0]) return userToWire(byOauth[0])

  // Link by email to an existing account
  if (email) {
    const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (byEmail[0]) {
      await db.update(users)
        .set({ oauthId, oauthProvider: provider })
        .where(eq(users.id, byEmail[0].id))
      return userToWire({ ...byEmail[0], oauthId, oauthProvider: provider })
    }
  }

  // Create a new user; the first user ever becomes admin
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
  const isFirstUser = Number(count) === 0
  const baseUsername = name?.replace(/\s+/g, '_').toLowerCase() || email?.split('@')[0] || 'user'
  let username = baseUsername
  let suffix = 1
  while ((await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)).length > 0) {
    username = `${baseUsername}_${suffix++}`
  }
  const newUser: typeof users.$inferInsert = {
    id: uuid(),
    username,
    email: email ?? null,
    oauthProvider: provider,
    oauthId,
    isAdmin: isFirstUser,
    permissions: DEFAULT_SELF_PERMISSIONS,
  }
  const inserted = await db.insert(users).values(newUser).returning()
  return userToWire(inserted[0])
}

// Public self-serve signup from the login page. The first account ever created
// becomes the admin.
export async function registerUser(username: string, password: string): Promise<{ success: boolean; message: string }> {
  const parsed = await signUpSchema.safeParseAsync({ username, password })
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Invalid username or password' }
  }

  const db = await getDb()
  const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
  if (dup.length > 0) {
    return { success: false, message: 'Username already taken' }
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
  const isFirstUser = Number(count) === 0

  await db.insert(users).values({
    id: uuid(),
    username,
    password: saltAndHashPassword(password),
    isAdmin: isFirstUser,
    permissions: DEFAULT_SELF_PERMISSIONS,
  })
  return { success: true, message: 'Account created' }
}

export async function getUser(username: string, plainTextPassword?: string): Promise<User | null> {
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1)
  if (!rows[0]) return null
  const user = userToWire(rows[0])
  const isValidPassword = verifyPassword(plainTextPassword, user.password)
  if (!isValidPassword) return null
  return user
}

export async function createUser(formData: FormData): Promise<PublicUser> {
  const username = formData.get('username') as string;
  let password = formData.get('password') as string | undefined;
  const avatarPath = formData.get('avatarPath') as string;
  const permissions = formData.get('permissions') ?
    JSON.parse(formData.get('permissions') as string) as Permission[] :
    undefined;

  if (password === null) password = undefined
  await signInSchema.parseAsync({ username, password });

  const db = await getDb()
  const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
  if (dup.length > 0) {
    throw new Error('Username already exists');
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
  const isFirstUser = Number(count) === 0
  const hashedPassword = password ? saltAndHashPassword(password) : undefined;

  const inserted = await db.insert(users).values({
    id: uuid(),
    username,
    password: hashedPassword ?? null,
    permissions: permissions ?? DEFAULT_SELF_PERMISSIONS,
    isAdmin: isFirstUser,
    avatarPath: avatarPath || null,
  }).returning()

  return sanitizeUserData({ users: [userToWire(inserted[0])] }).users[0]
}

// Caller must be an admin or the affected user themselves
async function requireSelfOrAdmin(userId: string): Promise<User> {
  const currentUser = await requireUser()
  if (!currentUser.isAdmin && currentUser.id !== userId) {
    throw new PermissionError('Not allowed to modify this user')
  }
  return currentUser
}

export async function updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'password'>>): Promise<PublicUser> {
  const caller = await requireSelfOrAdmin(userId)
  // Only admins may grant or revoke admin
  if (updates.isAdmin !== undefined && !caller.isAdmin) {
    delete updates.isAdmin
  }
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!rows[0]) throw new Error('User not found')

  if (updates.username) {
    const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, updates.username)).limit(1)
    if (dup.length > 0 && dup[0].id !== userId) {
      throw new Error('Username already exists')
    }
  }

  const set: Partial<typeof users.$inferInsert> = {}
  if (updates.username !== undefined) set.username = updates.username
  if (updates.avatarPath !== undefined) set.avatarPath = updates.avatarPath
  if (updates.permissions !== undefined) set.permissions = updates.permissions
  if (updates.isAdmin !== undefined) set.isAdmin = updates.isAdmin
  if (updates.email !== undefined) set.email = updates.email
  if (updates.lastNotificationReadTimestamp !== undefined) set.lastNotificationReadTimestamp = updates.lastNotificationReadTimestamp

  const updated = await db.update(users).set(set).where(eq(users.id, userId)).returning()
  return sanitizeUserData({ users: [userToWire(updated[0])] }).users[0]
}

export async function updateUserPassword(userId: string, newPassword?: string): Promise<void> {
  await requireSelfOrAdmin(userId)
  const db = await getDb()
  const hashedPassword = newPassword ? saltAndHashPassword(newPassword) : null
  const updated = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId)).returning({ id: users.id })
  if (updated.length === 0) throw new Error('User not found')
}

export async function deleteUser(userId: string): Promise<void> {
  await requireSelfOrAdmin(userId)
  const db = await getDb()
  // All user-owned rows (habits, completions, coins, xp, boss, pet, guild
  // membership, settings, avatars, push subscriptions, retention rows) are
  // removed via ON DELETE CASCADE foreign keys.
  const deleted = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id })
  if (deleted.length === 0) throw new Error('User not found')
}

export async function updateLastNotificationReadTimestamp(userId: string, timestamp: string): Promise<void> {
  await requireSelfOrAdmin(userId)
  const db = await getDb()
  const updated = await db.update(users)
    .set({ lastNotificationReadTimestamp: timestamp })
    .where(eq(users.id, userId))
    .returning({ id: users.id })
  if (updated.length === 0) throw new Error('User not found for updating notification timestamp')
}

export async function loadServerSettings(): Promise<ServerSettings> {
  return {
    isDemo: !!process.env.DEMO,
  }
}
