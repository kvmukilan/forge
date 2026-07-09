import { auth } from '@/auth'
import 'server-only'
import { User, UserId } from './types'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from './db'
import { users } from './db/schema'
import { userToWire } from './db/mappers'

export async function getCurrentUserId(): Promise<UserId | undefined> {
  const session = await auth()
  const user = session?.user
  return user?.id
}

export async function getCurrentUser(): Promise<User | undefined> {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) {
    return undefined
  }
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.id, currentUserId)).limit(1)
  return rows[0] ? userToWire(rows[0]) : undefined
}

export function saltAndHashPassword(password: string, salt?: string): string {
  if (password.length === 0) throw new Error('Password must not be empty')
  salt = salt || randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password?: string, storedHash?: string): boolean {
  // Accounts without a stored hash (e.g. OAuth-created) cannot sign in with credentials
  if (!password || !storedHash) return false

  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const newHash = saltAndHashPassword(password, salt).split(':')[1]
  const a = Buffer.from(newHash, 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
