# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

Forge is a gamified habit tracker (Next.js 15 App Router, React 19, TypeScript).
Users earn coins/XP for completing habits, keep streaks (with purchasable shields),
fight weekly bosses, raise a pet, run daily quests and login streaks, and compete
in weekly leagues and guilds. Ships as a PWA and as a Play Store TWA.

## Essential Commands

- `npm run dev` — dev server (Turbopack). Uses embedded PGlite Postgres in `./data/pglite` when `DATABASE_URL` is unset.
- `npm run typecheck` / `npm run lint` / `npm test` (bun) / `npm run build` — all four must pass; the pre-commit hook runs them plus a CHANGELOG version check.
- `bun scripts/seed.ts [user] [pass]` — seed a dev user (stop the dev server first; PGlite is single-writer).

## Architecture

### Persistence (Postgres + Drizzle)
- Schema: `lib/db/schema.ts`; client: `lib/db/index.ts` (`getDb()` — Neon HTTP driver when `DATABASE_URL` is set, PGlite otherwise; PGlite migrates lazily, Neon migrates at deploy via `scripts/migrate.mjs`).
- Migrations: `drizzle/` — regenerate with `npx drizzle-kit generate` after schema changes.
- Everything is per-user (`user_id` FKs, ON DELETE CASCADE). Completions are rows (`completions` table: habit_id, user_id, completed_at ISO string, note).
- **Wire format compatibility:** server actions still return the legacy JSON shapes from `lib/types.ts` (e.g. `Habit.completions: string[]`, `userIds: [ownerId]`). Mappers live in `lib/db/mappers.ts`. Don't break these shapes — the whole client depends on them.

### Server actions (all data access)
- `app/actions/data.ts` — habits, wishlist, coins, settings, users/auth, avatars (stored in DB, served via `/api/avatars`).
- `app/actions/gamification.ts` — XP, boss (per-user weekly), gems/shields/boosts, projects.
- `app/actions/retention.ts` — login calendar, daily quests, mystery chests, weekly league.
- `app/actions/guilds.ts`, `app/actions/pets.ts`, `app/actions/push.ts`.
- Auth checks: queries are scoped by `getCurrentUser()`; user mutations require self-or-admin.

### Crons (Vercel Cron, `vercel.json`)
- `/api/cron/daily` — overdue-task penalties (once per task), shield auto-consume, league week close. Bearer `CRON_SECRET`.
- `/api/cron/push` — reminder + streak-risk web push (dedup via `push_log`). Daily on Hobby; switch to hourly on Pro.

### State (Jotai)
- Core atoms `lib/atoms.ts`, gamification atoms `lib/gamification-atoms.ts`.
- SSR hydration: `app/layout.tsx` loads all tables → `components/jotai-providers.tsx` seeds a per-request store. No `atomWithStorage` (React 19 crash history) — localStorage sync is manual in `ClientWrapper`.
- Business logic hooks: `hooks/useHabits.tsx` (the ~200-line reward pipeline: coins → XP w/ boost/keystone/season/skill multipliers → boss damage → gem roll → milestones → perfect day), `useCoins`, `useWishlist`.

### Design system — "Kinetic Minimalism"
- Dark-only (forcedTheme). Tokens in `app/globals.css`: pure black bg, surfaces #111/#1A1A1A/#222, single ember accent #FF4D00, border #333, one radius (`rounded-lg`), Geist font.
- Rules: no gradients, no emoji-as-icons (lucide only; emoji allowed as content identity — pets, bosses, guild/season emblems), amber only for coins, emerald only for success, type scale text-xs/sm/base/lg/2xl + `.page-title`/`.section-label`/`.stat-number`/`.streak-number` utilities.

### PWA / Play
- Service worker: `app/sw.ts` via serwist (generated at build only — `/sw.js` 404s in dev). Manifest: `app/manifest.ts`. Asset links: `app/.well-known/assetlinks.json/route.ts` (env-driven). Play runbook: `docs/play-release.md`.

## Testing
- Bun tests. Integration tests (`lib/db/*.test.ts`) run against in-memory PGlite with `mock.module('@/lib/server-helpers')` to fake the session — follow that pattern for new action tests, and call `closeDb()` in `afterAll`.

## Conventions
- Conventional Commits. Update `CHANGELOG.md` when bumping `package.json` version (hook enforces it).
- i18n: original HabitTrove surfaces use `next-intl` (`messages/*.json`); Forge-era features are English-first — new UI strings don't need keys yet, but don't remove existing `t()` calls.
