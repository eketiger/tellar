# CLAUDE.md — Tellar Project Instructions

> This file guides every Claude Code session in this repo. It adapts the original
> project blueprint (see `docs/handoff.html`) to the actual monorepo we've built.

## Architecture (authoritative)

- **Monorepo** — pnpm workspaces + two apps under `apps/`:
  - `apps/api` — **NestJS 11** (not bundled with Next). Everything under `/api/*`.
  - `apps/web` — **Next.js 15** App Router. Uses `next.config.mjs` rewrites to proxy
    `/api/*` → NestJS during dev.
- **Shared types** — `packages/api-types` (Zod). Import from `@tellar/api-types`.
- **Database** — **Postgres 16 + Prisma 6**. Handoff §04 mandates Postgres + pgvector
  so the agent can do RAG. A PlanetScale/MySQL swap would lose pgvector and the
  RAG pipeline — if a future session needs MySQL, migrate the embedding store to
  Pinecone first (Section 10 of the original spec) and keep Prisma `mysql` provider.
- **Auth** — argon2-hashed passwords, httpOnly JWT cookie (`tellar_jwt`), symmetric
  JWT by default. Viewer gate mints a short-lived `x-share-token` header. We do
  NOT use NextAuth — the Next app is a client of the NestJS `/api/auth/*` endpoints
  so both SSR and CSR share one source of truth.
- **Realtime** — Socket.IO, `/ws` namespace, room-per-share.
- **Agent RAG** — Claude + keyword rerank out of the box; upgrades to OpenAI
  embeddings + Pinecone when those env vars are set.

## Companion instruction files

- `CLAUDE-docs.md` — Fumadocs (/docs, /help) + Scalar (/api-reference) + OpenAPI conventions
- `CLAUDE-infra.md` — AWS CDK stacks (`infra/`), CI/CD, OIDC federation

All three files apply together. When a later session re-reads this repo, it should treat them
as one authoritative source of truth.

## Rules for Claude Code sessions

- **Never regress architecture above** unless the user asks explicitly. If a spec
  hints at a different stack (Next-only monolith, MySQL, NextAuth), translate it to
  the monorepo architecture and call out the translation in chat.
- **All mutating routes are behind** `JwtGuard + WorkspaceGuard` (tenant check). New
  controllers must use both. Admin-only routes additionally use `AdminGuard`.
- **Use the shared Zod DTOs** from `@tellar/api-types` for all request bodies.
- **Third-party services are optional by default.** Each integration (Claude,
  OpenAI, Pinecone, Stripe, Mixpanel, OAuth) must degrade gracefully when its env
  var is unset. The app has to run with zero external keys.
- **GDPR** — never log `email`, `name`, raw IPs. Hash/mask PII in logs. Always
  respect `deletionRequestedAt` (soft-delete) before hard-deleting.
- **Rate-limit Claude calls** — Copilot: 50/day/user. Ask: 20/day/user/teller.
  Use `CopilotUsage` / `AskUsage` tables.
- **Tests** — Jest on the backend, targeted unit tests for services and guards.
  100% coverage is a goal, not a gate, in this repo; CI runs `--coverage` and
  surfaces the number but does not fail the build.

## How to run

See `README.md` → "Quick start". Demo login: `martin@tellar.studio` / `demo1234`.

## Env vars

See `apps/api/.env.example` and `apps/web/.env.example`. All third-party integrations
are optional; the app boots without them.

## Backoffice

Visit `/admin` as a user whose `role === 'ADMIN'`. The seed script makes
`martin@tellar.studio` an admin so you can see it immediately.

Admin surface:
- `/admin` — KPI dashboard (accounts, workspaces, tellers, MRR, active subs)
- `/admin/accounts` — users table with search, promote/demote admin, suspend
- `/admin/workspaces` — workspaces + plan + seats + last activity
- `/admin/billing` — subscription + invoice roll-up
- `/admin/events` — recent platform events (signup, share_open, agent_query)

## File-by-file conventions

- `apps/api/src/**/<name>.module.ts` — Nest module (one per domain)
- `apps/api/src/**/<name>.controller.ts` — REST routes, thin, delegate to service
- `apps/api/src/**/<name>.service.ts` — business logic, owns Prisma calls
- `apps/web/app/**/page.tsx` — RSC by default; promote to Client only when needed
- `apps/web/app/**/<Name>Client.tsx` — Client islands
- `apps/web/components/` — shared UI primitives
- `apps/web/lib/` — framework-agnostic helpers

## GDPR defaults

- Cookie banner must render before any Mixpanel/analytics SDK is initialised.
- `/api/user/data-export` returns JSON of everything joinable to the user id.
- `/api/user/account` DELETE sets `deletionRequestedAt` then queues hard delete.

## PR/commit style

- Short imperative subject, body explains "why" and lists every touched subsystem.
- Never commit `node_modules`, `.env`, `dist`, `.next`, coverage, uploads.
