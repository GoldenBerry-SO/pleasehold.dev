# Infrastructure & Deployment

This document covers deployment pipelines, infrastructure topology, and operational details for pleasehold. For local development setup, see the [README](../README.md).

## Deployment Overview

| Component | Platform | Trigger | URL pattern |
|-----------|----------|---------|-------------|
| API + Worker + Web | Kubernetes (via GitOps) | Push to `main` | staging cluster |
| Landing site (www) | Cloudflare Pages | Push to `main` (path-filtered) | `pleasehold-www.pages.dev` |
| Self-hosted | Docker Compose | Manual | User-defined |

## CI/CD Pipelines

### Staging Deploy (`deploy-staging.yml`)

Triggered on every push to `main` or manual dispatch.

```
push to main
    |
    v
[build job]
    |- Build API Docker image -----> ghcr.io/goldenberry-so/pleasehold/api:<sha>
    |- Build Web Docker image -----> ghcr.io/goldenberry-so/pleasehold/web:<sha>
    |- Build Worker Docker image --> ghcr.io/goldenberry-so/pleasehold/worker:<sha>
    |
    v
[deploy job]
    |- Checkout GoldenBerry-SO/infra repo
    |- kustomize edit set image (all 3 tags)
    |- Commit & push to infra repo (with retry)
    |
    v
[GitOps controller picks up change and rolls out to Kubernetes]
```

**Docker images** are tagged with the commit SHA and pushed to GitHub Container Registry (GHCR). The API and Worker images include Infisical CLI for runtime secret injection. The Web image uses nginx to serve the static SPA.

**GitOps deployment** updates the `GoldenBerry-SO/infra` repo at `k8s/apps/pleasehold/kustomization.yaml`. An external GitOps controller (e.g., Argo CD or Flux) reconciles the cluster state.

**Required secrets:**

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | GHCR push (automatic) |
| `INFISICAL_CLIENT_ID` | Baked into API/Worker images for runtime secret injection |
| `INFISICAL_CLIENT_SECRET` | Baked into API/Worker images for runtime secret injection |
| `INFISICAL_PROJECT_ID` | Baked into API/Worker images for runtime secret injection |
| `INFRA_DEPLOY_KEY` | private half of a write deploy key on `GoldenBerry-SO/infra` |

### Landing Site Deploy (`deploy-www.yml`)

Triggered on push to `main` when `apps/www/**` changes, on PRs against `main` (same path filter), or manual dispatch.

```
push to main (apps/www/** changed)
    |
    v
[deploy job]
    |- pnpm install --frozen-lockfile
    |- pnpm --filter @pleasehold/www build
    |- wrangler pages project create (idempotent, continue-on-error)
    |- wrangler pages deploy dist/
    |
    v
[live on Cloudflare Pages]
    |- main branch  --> production (pleasehold-www.pages.dev)
    |- PR branches  --> preview (unique-hash.pleasehold-www.pages.dev)
```

**Required secrets:**

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API (needs `Cloudflare Pages: Edit` permission) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier |

## Infrastructure Topology

### Staging / Production (Kubernetes)

```
                    Internet
                       |
                   [Ingress]
                    /      \
                   v        v
              [API :3001]  [Web :80 (nginx)]
               /     \          |
              v       v         | reverse proxy:
         [Postgres]  [Redis]    |  /api/*  -> api:3001
              |        |        |  /trpc/* -> api:3001
              v        v        |  /verify/* -> api:3001
         [Migrations]  |        |  /doc, /docs, /health -> api:3001
                       |        |  /* -> SPA fallback
                       v
                   [Worker]
                       |
                       v
               [Notification channels]
               Email / Slack / Discord / Telegram / Webhook
```

- **API** and **Worker** both connect to Postgres and Redis
- **Worker** consumes the `notifications` BullMQ queue from Redis (concurrency 5)
- **Web** is a static nginx container that reverse-proxies API routes and serves the SPA
- **Migrations** run inline at container startup (`migrate.mjs` before `node dist/index.js`)
- **Secrets** are injected at runtime via Infisical (`docker-entrypoint.sh` wraps CMD with `infisical run` when credentials are present)

### Self-Hosted (Docker Compose)

```
docker compose up
    |
    |- postgres:16-alpine         (internal)
    |- redis:7-alpine             (internal, noeviction policy)
    |- minio                      (internal, S3-compatible)
    |- migrate (one-shot)         runs db:generate + db:migrate, then exits
    |- api                        (host:3001)  starts after migrate completes
    |- worker                     (no port)    starts after migrate completes
    |- web                        (host:8080)  starts after api is healthy
```

All services share a `pleasehold` bridge network. Postgres and Redis data are persisted in named volumes.

## Docker Build Strategy

All three app Dockerfiles use the same 4-stage multi-stage pattern:

```
Stage 1: base          node:22-alpine
Stage 2: pruner        turbo prune --docker (minimal monorepo slice)
Stage 3: installer     pnpm install --frozen-lockfile (on pruned manifests)
Stage 4: builder       copy full source, turbo build --filter=@pleasehold/<app>...
Stage 5: runner        copy build artifacts only, run as non-root user
```

| App | Runner base | Extras |
|-----|-------------|--------|
| API | `node:22-alpine` | Infisical CLI, `docker-entrypoint.sh` |
| Worker | `node:22-alpine` | Infisical CLI, `docker-entrypoint.sh` |
| Web | `nginx:alpine` | Custom `nginx.conf`, no Node.js |

The Web image bakes `VITE_API_URL` at build time. API and Worker accept Infisical build args but resolve secrets at runtime.

## Secret Management

Two modes, same app code:

| Mode | Mechanism | Who |
|------|-----------|-----|
| `.env` file | `docker-compose.yml` reads `.env` | Self-hosters |
| Infisical | `docker-entrypoint.sh` conditionally wraps CMD with `infisical run` | Managed deployments |

The entrypoint decision is purely runtime:

```sh
if [ -n "$INFISICAL_CLIENT_ID" ] && [ -n "$INFISICAL_CLIENT_SECRET" ]; then
  # login via universal-auth, then: exec infisical run -- "$@"
else
  exec "$@"   # plain env vars
fi
```

Infisical instance: `https://infisical.goldenberry.so` (self-hosted). Configurable via `INFISICAL_DOMAIN`.

## Startup Sequence (Kubernetes)

```
Container starts
    |
    v
docker-entrypoint.sh
    |- Infisical credentials present?
    |     yes -> infisical login -> infisical run -- CMD
    |     no  -> exec CMD directly
    |
    v
CMD: node packages/db/migrate.mjs && exec node apps/<app>/dist/index.js
    |
    |- migrate.mjs: apply pending Drizzle migrations (idempotent)
    |- if DATABASE_URL unset: warn and exit 0
    |
    v
App process running
```

## Git Hooks

| Hook | Runs |
|------|------|
| `pre-commit` | `turbo lint` + `turbo typecheck` |
| `pre-push` | `turbo typecheck` + `turbo lint` + `turbo build` |
| `commit-msg` | Enforces [Conventional Commits](https://www.conventionalcommits.org/) format |
