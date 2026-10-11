# Production deployment

Docker: copy `.env.example` to `.env`, set a randomly generated `AUTH_SECRET`, then run `docker compose up -d --build`. The image runs as UID 1001, includes Drizzle migrations, and exposes `/api/health` without authentication or database initialization. Create `data/` and `backups/` with UID 1001 write access before using the bind mounts. Keep a consistent secret across restarts.

The `Publish verified Forge image` workflow is manual, requires a reviewed main commit, passes the build/test/container workflow, and publishes to `ghcr.io/kvmukilan/forge` with a commit tag. It replaces inherited publishing to another account's DockerHub image and Kubernetes deployment. Promote a specific image digest; retain the prior digest for rollback. Database changes must remain compatible with the preceding release, since rolling back code does not roll back migrations.

For Vercel, use the Git integration and require the Production readiness check. Set `AUTH_SECRET`, the public `AUTH_URL`, and a persistent `DATABASE_URL` in the hosting environment. Keep preview and production databases separate. Builds no longer mutate the database; back up the intended database and run `npm run db:migrate` with that environment's `DATABASE_URL` from a trusted release job before promoting the reviewed commit. Never give an unreviewed preview branch production database credentials. The local embedded database is intended for a single persistent Docker instance, not serverless filesystem storage.

Geist is bundled from a pinned font package so production builds do not need to download fonts from Google.

Verify `/api/health`, sign in, create a habit, restart, and confirm it persists. Back up the external database or stop the embedded instance before copying its storage directory.
