# Tellar API — NestJS monorepo container
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/api-types/package.json packages/api-types/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN pnpm --filter @tellar/api prisma generate
RUN pnpm --filter @tellar/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
EXPOSE 3333
CMD ["node", "dist/main.js"]
