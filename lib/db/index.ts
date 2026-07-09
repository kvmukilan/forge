import 'server-only'
import path from 'path'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

// Cached across hot reloads (dev) and across invocations within a warm lambda (prod)
const globalForDb = globalThis as unknown as {
  __forgeDb?: Promise<Db>
  __forgePglite?: { close(): Promise<void> }
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { neon } = await import('@neondatabase/serverless')
    const { drizzle } = await import('drizzle-orm/neon-http')
    // Migrations for Neon run at deploy time (scripts/migrate.mjs), not here
    return drizzle(neon(url), { schema }) as unknown as Db
  }

  // No DATABASE_URL: embedded Postgres (PGlite) for local dev and tests.
  // Tests use in-memory storage; dev persists to ./data/pglite.
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const storage = process.env.NODE_ENV === 'test' || process.env.BUN_TEST
    ? undefined
    : path.join(process.cwd(), 'data', 'pglite')
  if (storage) {
    const { mkdir } = await import('fs/promises')
    await mkdir(storage, { recursive: true })
  }
  const client = storage ? new PGlite(storage) : new PGlite()
  globalForDb.__forgePglite = client
  const db = drizzle(client, { schema }) as unknown as Db
  await migrate(db as never, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return db
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__forgeDb) {
    // Don't cache a failed init — a transient error would otherwise wedge the process
    globalForDb.__forgeDb = createDb().catch((err) => {
      globalForDb.__forgeDb = undefined
      throw err
    })
  }
  return globalForDb.__forgeDb
}

// Used by tests to release the PGlite handle so the runner can exit cleanly
export async function closeDb(): Promise<void> {
  if (globalForDb.__forgePglite) {
    await globalForDb.__forgePglite.close()
    globalForDb.__forgePglite = undefined
  }
  globalForDb.__forgeDb = undefined
}

export { schema }
