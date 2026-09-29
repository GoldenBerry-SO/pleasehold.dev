<p align="center">
  <img src=".github/logo.svg" width="80" height="80" alt="pleasehold logo" />
</p>

<h1 align="center">pleasehold</h1>

<p align="center">
  API-first waitlist service. Add a signup form to any landing page in minutes — just an API key and a POST request. No backend work, no form infrastructure.
</p>

Developers build their own frontend forms; pleasehold handles the backend: entry capture, deduplication, notifications, and a management dashboard.

Open source. Self-hostable via Docker.

## Quick Start (Docker)

```bash
git clone https://github.com/GoldenBerry-SO/pleasehold.dev.git
cd pleasehold.dev
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and BETTER_AUTH_SECRET at minimum
docker compose up
```

Dashboard: [http://localhost:8080](http://localhost:8080)
API: [http://localhost:3001](http://localhost:3001)
API docs: [http://localhost:3001/docs](http://localhost:3001/docs)

## How It Works

1. **Sign up** at the dashboard and create a project (waitlist or demo-booking mode)
2. **Generate an API key** (`ph_live_...`) scoped to your project
3. **Configure fields** — choose what to collect (email, name, company, message, custom metadata)
4. **POST entries** from your frontend form to the REST API
5. **Get notified** via email, Slack, Discord, Telegram, or webhook
6. **Manage entries** in the dashboard — search, filter, bulk actions, CSV export

## API Usage

Submit an entry with a single HTTP request:

```bash
curl -X POST https://your-api.example.com/api/v1/entries \
  -H "Content-Type: application/json" \
  -H "x-api-key: ph_live_your_key_here" \
  -d '{
    "email": "user@example.com",
    "name": "Jane Doe",
    "company": "Acme Inc",
    "message": "Interested in early access",
    "metadata": { "referral": "twitter", "plan": "pro" }
  }'
```

Response:

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "name": "Jane Doe",
    "company": "Acme Inc",
    "position": 42,
    "createdAt": "2026-01-15T09:30:00.000Z"
  }
}
```

- **Deduplication** — duplicate emails return `200` with the existing entry (idempotent)
- **Rate limiting** — 60 requests/min per API key
- **Dynamic validation** — fields are validated against your project's field configuration
- **Double opt-in** — optional email verification before entries become active

Interactive API documentation is available at `/docs` (powered by Scalar).

## Local Development

### Prerequisites

- Node.js >= 22
- pnpm 10+
- PostgreSQL 16
- Redis 7

### Setup

```bash
# Start infrastructure (PostgreSQL on :5434, Redis on :6380)
docker compose -f docker-compose.dev.yml up -d

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env — set DATABASE_URL to postgresql://pleasehold:pleasehold@localhost:5434/pleasehold

# Run database migrations
pnpm db:generate
pnpm db:migrate

# Start all services
pnpm dev
```

This runs the API server, web dashboard, and background worker concurrently via Turborepo.

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run Biome linting and formatting checks |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm clean` | Remove build artifacts and node_modules |

## Architecture

```
pleasehold/
├── apps/
│   ├── api/           Hono server — REST API + tRPC + auth + OpenAPI docs
│   ├── web/           React 19 SPA — dashboard (Vite + TanStack Router)
│   ├── worker/        BullMQ processor — notifications + background jobs
│   └── www/           Astro landing site (Cloudflare Pages)
├── packages/
│   ├── db/            Drizzle ORM schema + PostgreSQL client
│   ├── auth/          Better Auth configuration
│   └── trpc/          tRPC routers + context
├── docker-compose.yml          Production stack
├── docker-compose.dev.yml      Dev infrastructure (Postgres + Redis)
└── .env.example                Environment template
```

For deployment pipelines and infrastructure topology, see [docs/infrastructure.md](docs/infrastructure.md).

### Design Decisions

- **Dual API** — REST for external developers (simple HTTP + API key), tRPC for the dashboard (type-safe RPC with session auth)
- **Single Hono server** — REST routes, tRPC, and auth share one process, one DB pool
- **Separate worker process** — BullMQ runs in `apps/worker` so long-running notification delivery doesn't block the API
- **API-first, no widget** — developers build their own forms and get full control over the UX
- **Path-specific CORS** — `origin: *` on `/api/v1/*` for external devs, restricted origin on `/trpc/*` and `/api/auth/*`
- **Rate limiting before auth** — prevents DB floods from unauthenticated garbage requests

### Notification Pipeline

Entry submission triggers an async fan-out through BullMQ:

1. Entry inserted → `notification-dispatch` job enqueued
2. Worker reads project notification channels
3. Per-channel delivery jobs enqueued (`email-send`, `slack-notify`, `webhook-dispatch`, etc.)
4. Each channel retries independently with exponential backoff (48-hour window)
5. Webhooks are signed with HMAC-SHA256

Supported channels: **Email**, **Slack**, **Discord**, **Telegram**, **Webhook**

## Dashboard

The web dashboard provides:

- **Project management** — create and configure projects, toggle waitlist/demo-booking mode
- **Entry table** — paginated list with search, status filters, and bulk actions
- **Entry detail** — view full submission data, update status
- **API keys** — generate and revoke project-scoped keys
- **Notifications** — configure channels per project
- **CSV export** — download entries for external tools

Routes use TanStack Router with file-based routing and type-safe navigation.

## Environment Variables

Copy `.env.example` to `.env` and configure. See also the [Secret Management](#secret-management) section below for Infisical-based workflows.

### Required (app won't start without these)

| Variable | Description | Suggestion |
|----------|-------------|------------|
| `DATABASE_URL` | PostgreSQL connection string (dev only — Docker Compose builds it from `POSTGRES_*` vars) | `postgresql://pleasehold:<pw>@<host>:5432/pleasehold` |
| `POSTGRES_DB` | Database name | `pleasehold` |
| `POSTGRES_USER` | Database user | `pleasehold` |
| `POSTGRES_PASSWORD` | Database password | Generate: `openssl rand -base64 16` |
| `BETTER_AUTH_SECRET` | Session signing key (32+ chars) | Generate: `openssl rand -base64 32` |
| `REDIS_PASSWORD` | Redis auth password | Generate: `openssl rand -base64 16` |
| `MINIO_ROOT_USER` | MinIO/S3 admin username | `minioadmin` or custom |
| `MINIO_ROOT_PASSWORD` | MinIO/S3 admin password | Generate: `openssl rand -base64 16` |

### Required for production routing

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Public-facing API URL | `http://localhost:3001` |
| `WEB_URL` | Public-facing dashboard URL | `http://localhost:8080` |

### Optional (features degrade gracefully without them)

| Variable | Description | Needed for |
|----------|-------------|------------|
| `RESEND_API_KEY` | [Resend](https://resend.com) API key | Email notifications + double opt-in |
| `EMAIL_FROM` | Sender address (must be verified in Resend) | Email delivery |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | GitHub login |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | GitHub login |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Google login |
| `S3_ENDPOINT` | S3-compatible endpoint URL | Logo uploads (defaults to MinIO) |
| `S3_BUCKET` | S3 bucket name | Logo uploads (defaults to `pleasehold`) |
| `S3_ACCESS_KEY_ID` | S3 access key | Logo uploads |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | Logo uploads |
| `S3_PUBLIC_URL` | Public URL for serving S3 assets | Logo display |

### Infisical (for managed deployments only)

These are only needed if using [Infisical](https://infisical.com) for centralized secret management. Self-hosters can ignore them entirely.

| Variable | Description | Default |
|----------|-------------|---------|
| `INFISICAL_CLIENT_ID` | Machine identity client ID | — |
| `INFISICAL_CLIENT_SECRET` | Machine identity client secret | — |
| `INFISICAL_PROJECT_ID` | Infisical project ID | — |
| `INFISICAL_ENV` | Environment to pull secrets from | `production` |
| `INFISICAL_DOMAIN` | Infisical instance URL (for self-hosted Infisical) | `https://app.infisical.com` |

## Secret Management

pleasehold supports two ways to manage secrets:

### Option A: `.env` File (Self-Hosted)

The default for self-hosters. Copy `.env.example` to `.env`, fill in your values, and run `docker compose up`. No extra tooling required.

```bash
cp .env.example .env
# Edit .env with your values
docker compose up
```

### Option B: Infisical (Managed Deployments)

For teams using [Infisical](https://infisical.com) for centralized secret management. The app code is identical — Infisical injects secrets via the `infisical run` CLI wrapper.

**Local development with Infisical:**

```bash
# One-time setup
brew install infisical/get-cli/infisical   # or see https://infisical.com/docs/cli/overview
make infisical-login                        # Authenticate
make infisical-init                         # Link workspace (creates .infisical.json)
make infisical-setup                        # Interactive: populate secrets

# Daily development
make dev                                    # Starts with Infisical-injected secrets
```

**Docker with Infisical:**

Set `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, and `INFISICAL_PROJECT_ID` in your environment (or CI). The Docker entrypoint automatically wraps the app with `infisical run` when these are present. Without them, containers run normally with env vars from `docker-compose.yml`.

Run `make help` to see all available targets.

## Tech Stack

- **Runtime:** Node.js 22, TypeScript 5.7
- **API:** [Hono](https://hono.dev) + [tRPC 11](https://trpc.io) + [Zod](https://zod.dev)
- **Database:** PostgreSQL 16 via [Drizzle ORM](https://orm.drizzle.team)
- **Auth:** [Better Auth](https://www.better-auth.com) (email/password + GitHub/Google OAuth)
- **Jobs:** [BullMQ](https://bullmq.io) + Redis 7
- **Frontend:** React 19 + [Vite](https://vite.dev) + [TanStack Router](https://tanstack.com/router) + [TanStack Table](https://tanstack.com/table)
- **API Docs:** [Scalar](https://scalar.com) (auto-generated from OpenAPI spec)
- **Monorepo:** pnpm + [Turborepo](https://turbo.build)
- **Code Quality:** [Biome](https://biomejs.dev) + [Vitest](https://vitest.dev)
- **Landing Site:** [Astro](https://astro.build) + Tailwind CSS 4 (Cloudflare Pages)
- **Deployment:** Docker multi-stage builds + nginx reverse proxy + Cloudflare Pages

## Self-Hosting Notes

The Docker Compose stack runs five services:

| Service | Purpose |
|---------|---------|
| `postgres` | Data storage (persistent volume) |
| `redis` | Job queue + rate limiting (`noeviction` policy required) |
| `migrate` | One-shot migration runner (exits after completion) |
| `api` | Hono API server (port 3001) |
| `worker` | BullMQ notification processor |
| `web` | React dashboard + nginx reverse proxy (port 8080) |

The `web` service includes an nginx reverse proxy that routes `/api/*`, `/trpc/*`, and `/health` to the API container. The dashboard SPA handles all other routes client-side.

Migrations run automatically on startup via the `migrate` service before the API and worker start.

## Database Migrations

Drizzle ORM manages the database schema. Migration SQL files live in `packages/db/drizzle/` and are tracked in `packages/db/drizzle/meta/_journal.json`.

### How Migrations Run

Migrations are applied automatically on every deployment — no manual steps required. The mechanism differs by environment:

**Docker Compose (self-hosted):**

The `migrate` service runs `pnpm db:generate && pnpm db:migrate` as a one-shot container before the API and worker start. Both `api` and `worker` have `depends_on: migrate: condition: service_completed_successfully`, so they wait until migrations finish.

**Kubernetes (staging/production):**

Each container (API and worker) runs migrations inline at startup via `packages/db/migrate.mjs`. The Dockerfile CMD is:

```
CMD ["sh", "-c", "node packages/db/migrate.mjs && exec node apps/api/dist/index.js"]
```

The startup sequence is:

1. `docker-entrypoint.sh` runs as the ENTRYPOINT
2. If Infisical credentials are present, the entrypoint wraps the CMD with `infisical run`, injecting secrets (including `DATABASE_URL`) into the environment
3. `migrate.mjs` connects to PostgreSQL, applies any pending migrations from `packages/db/drizzle/`, then exits
4. If `DATABASE_URL` is not set, `migrate.mjs` logs a warning and exits cleanly (exit 0)
5. The application starts

Migrations are **idempotent** — Drizzle tracks applied migrations in a `__drizzle_migrations` table, so running them on every boot is safe even when multiple replicas start simultaneously.

### Creating New Migrations

```bash
# After modifying the schema in packages/db/src/schema.ts:
pnpm db:generate          # Generate SQL migration files
pnpm db:migrate           # Apply locally (dev)
```

Migration files are committed to git and deployed with the application code. They are applied automatically on the next deployment — no additional steps needed.

### Troubleshooting

If migrations fail on startup, the container exits with code 1 and logs the error. Check container logs:

```bash
# Docker Compose
docker compose logs api

# Kubernetes
kubectl logs -l app=api --tail=50
```

Common causes:
- `DATABASE_URL` not set or incorrect — check Infisical secrets or environment variables
- Database not reachable — verify network connectivity and PostgreSQL health
- Conflicting schema — a migration references a table/column that was manually modified

---

<p align="center">
  Built by <a href="https://pixeltowers.io">PixelTowers.io</a><br />
  <sub>Products that empower, not replace.</sub>
</p>
