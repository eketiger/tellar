# Tellar

> Presentations that know when they lose you.

Full-stack implementation of the Tellar prototype per [`docs/handoff.md`](docs/handoff.md).

- **Frontend** — Next.js 15 (App Router) · Tailwind-less raw CSS tokens from the prototype
- **Backend** — NestJS 11 · Prisma 6 · Postgres 16 (+ pgvector recommended)
- **Realtime** — Socket.IO (Redis adapter optional)
- **LLM** — Claude (Anthropic) + OpenAI embeddings (optional, falls back to keyword search)

## Monorepo

```
apps/
  api/                NestJS backend
  web/                Next.js frontend
packages/
  api-types/          Shared Zod DTOs + TS types
```

## Quick start

```bash
pnpm install

# API — copy .env.example and fill in DATABASE_URL, JWT_SECRET, etc.
cp apps/api/.env.example apps/api/.env

# Run migrations + seed the demo workspace
pnpm --filter @tellar/api prisma migrate dev
pnpm --filter @tellar/api db:seed

# Run everything in dev mode
pnpm dev
```

- Web → http://localhost:3000
- API → http://localhost:3333
- Demo login: `martin@tellar.studio` / `demo1234`

## Environment

See `apps/api/.env.example` and `apps/web/.env.example`.

Required:
- `DATABASE_URL` — Postgres (or `file:./dev.db` for SQLite in dev)
- `JWT_SECRET` — any random string
- `WEB_ORIGIN` — CORS origin

Optional (enables real agent):
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

Optional infra:
- `REDIS_URL` (Socket.IO adapter, queues)
- `S3_*` (recordings + KB storage)

## Design

UI tokens and layouts are ported 1:1 from the HTML prototype (see `apps/web/app/globals.css`). Fonts: Fraunces, Inter Tight, JetBrains Mono.
