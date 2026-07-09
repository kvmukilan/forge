// Seeds a local dev user (PGlite or DATABASE_URL). Run with the dev server STOPPED
// (PGlite allows a single writer):  bun scripts/seed.ts [username] [password]
import path from 'path'
import { randomBytes, scryptSync } from 'crypto'
import { users } from '../lib/db/schema'
import { sql } from 'drizzle-orm'

const username = process.argv[2] ?? 'demo'
const password = process.argv[3] ?? 'password123'

function saltAndHashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`
}

async function main() {
  let db
  if (process.env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless')
    const { drizzle } = await import('drizzle-orm/neon-http')
    db = drizzle(neon(process.env.DATABASE_URL))
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle } = await import('drizzle-orm/pglite')
    const { migrate } = await import('drizzle-orm/pglite/migrator')
    const client = new PGlite(path.join(process.cwd(), 'data', 'pglite'))
    db = drizzle(client)
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
  const isFirstUser = Number(count) === 0

  await db.insert(users).values({
    id: crypto.randomUUID(),
    username,
    password: saltAndHashPassword(password),
    isAdmin: isFirstUser,
  }).onConflictDoNothing()

  console.log(`Seeded user '${username}' (admin: ${isFirstUser}) with password '${password}'`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
