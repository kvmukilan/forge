# Forge

**Forge your best self.** A gamified habit tracker where consistency is the core loop:
complete habits, earn coins and XP, keep streaks alive, battle weekly bosses, raise a
companion, and climb the weekly league — solo or with your guild.

Built with Next.js 15, React 19, Postgres (Neon), Drizzle, Jotai, and NextAuth.
Ships to the web as a PWA and to Google Play as a Trusted Web Activity.

## Features

**Habits & tasks**
- Daily/weekly/custom recurring habits (natural-language frequencies) and one-off tasks with due dates
- One-tap logging with undo, swipe-to-complete on mobile, "Complete all" quick action
- Per-completion notes, partial completions (n× per day targets), implementation intentions, keystone habits
- Calendar heatmaps, per-habit stats, yearly analytics

**Progression**
- Coins (spend on your own reward wishlist) and XP with levels, difficulty multipliers, and skill trees
- Streaks with milestones — and **streak shields** that auto-spend to save a missed day
- Weekly boss battles, an evolving companion pet, monthly seasons with rotating bonuses
- Achievements and equippable titles

**Retention loop**
- 7-day escalating daily-login calendar
- 3 rotating daily quests; clearing all grants a **mystery chest** (variable rewards)
- Streak-at-risk warnings in-app and via push
- Weekly leagues: 15-person cohorts, five tiers (Bronze → Ember), promotion and demotion
- Guilds with invite codes, shared weekly quests, leaderboards, and activity feeds
- Web-push reminders timed to your schedule, with rotating copy

## Development

```bash
npm install --force
cp .env.example .env.local   # set AUTH_SECRET at minimum
npm run dev
```

No database setup needed for local dev: without `DATABASE_URL`, Forge runs on an
embedded Postgres (PGlite) stored in `./data/pglite`. Seed a user with
`bun scripts/seed.ts` (dev server stopped), or just create an account on the
login page — the first account becomes admin.

Quality gates (also run by the pre-commit hook):

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Deployment (Vercel + Neon)

1. Create a Neon Postgres database (Vercel Marketplace) — sets `DATABASE_URL`.
2. Set env vars: `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET` (optional OAuth),
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (push), `CRON_SECRET`.
3. Deploy. Migrations run automatically at build (`scripts/migrate.mjs`);
   `vercel.json` schedules the daily maintenance and push crons.

## Google Play

The Android app is a TWA generated with Bubblewrap from the live deployment.
The complete runbook — Play Console setup, Digital Asset Links, data-safety
form, closed-testing requirements — is in [docs/play-release.md](docs/play-release.md).

## License

GNU AGPL v3.0 — see [LICENSE](LICENSE). Forge began as a fork of
[HabitTrove](https://github.com/dohsimpson/habittrove).
