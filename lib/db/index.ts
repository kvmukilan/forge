import 'server-only'
import path from 'path'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

// Cached across hot reloads (dev) and across invocations within a warm lambda (prod)
const globalForDb = globalThis as unknown as {
  __forgeDb?: Promise<Db>
  __forgePglite?: { close(): Promise<void> }
  __forgeNeonPool?: { end(): Promise<void> }
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { Pool } = await import('@neondatabase/serverless')
    const { drizzle } = await import('drizzle-orm/neon-serverless')
    // Migrations for Neon run at deploy time (scripts/migrate.mjs), not here
    const pool = new Pool({ connectionString: url })
    globalForDb.__forgeNeonPool = pool
    return drizzle(pool, { schema }) as unknown as Db
  }

  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is required when Forge runs on Vercel')
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
  if (globalForDb.__forgeNeonPool) {
    await globalForDb.__forgeNeonPool.end()
    globalForDb.__forgeNeonPool = undefined
  }
  globalForDb.__forgeDb = undefined
}

export { schema }
