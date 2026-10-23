# ABOUTME: Multi-stage Docker build for the pleasehold web dashboard.
# ABOUTME: Builds the React SPA with Vite, serves static files via nginx with API reverse proxy.

FROM node:22.23.4-alpine AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

FROM base AS pruner
RUN pnpm add -g turbo@2.4.4
WORKDIR /app
COPY . .
RUN turbo prune @pleasehold/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# Strip overrides for packages not in any Docker-built app (e.g. astro).
# Must patch both package.json AND pnpm-lock.yaml so --frozen-lockfile sees matching config.
# Also inject missing zod package entries that turbo prune omits (scoped override bug).
COPY --from=pruner /app/pnpm-lock.yaml /tmp/original-pnpm-lock.yaml
COPY scripts/patch-pruned-lockfile.mjs /tmp/
RUN node /tmp/patch-pruned-lockfile.mjs
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.json ./tsconfig.json
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm turbo build --filter=@pleasehold/web...

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
