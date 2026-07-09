// Runs Drizzle migrations against DATABASE_URL (Neon) at deploy time.
// Skips silently when DATABASE_URL is not set (local dev migrates PGlite lazily).
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

const url = process.env.DATABASE_URL
if (!url) {
  console.log('migrate: DATABASE_URL not set, skipping (PGlite migrates lazily in dev)')
  process.exit(0)
}

const db = drizzle(neon(url))
await migrate(db, { migrationsFolder: './drizzle' })
console.log('migrate: database is up to date')
