# Resolve the base image for the target platform so native modules match it.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS base

# Install dependencies only when needed
FROM base AS deps
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    apk add --no-cache libc6-compat
WORKDIR /app

# Use cache mounts for npm cache
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN --mount=type=cache,target=/root/.npm --mount=type=secret,id=proxy_ca \
  if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Enables output:'standalone' in next.config.ts (required by the runner stage below)
ARG DOCKER_BUILD=1
ENV DOCKER_BUILD=$DOCKER_BUILD

# Use cache mount for Next.js cache
RUN --mount=type=cache,target=/app/.next/cache \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image - use target platform
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/data /app/backups && \
    chown nextjs:nodejs /app/data /app/backups

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/CHANGELOG.md ./
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

VOLUME ["/app/data", "/app/backups"]

CMD ["node", "server.js"]
