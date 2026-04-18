# Tellar Web — Next.js monorepo container
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/api-types/package.json packages/api-types/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN pnpm --filter @tellar/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/web/next.config.mjs ./next.config.mjs
COPY --from=build /repo/packages ./packages
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
