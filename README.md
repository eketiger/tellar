# Tellar

> Presentations that know when they lose you.

Full-stack implementation of the Tellar handoff spec: **DocSend × Loom × AI agents**.
Share decks that track per-slide drop-off, record narration, and answer viewer
questions from your knowledge base.

- **Frontend** — Next.js 15 (App Router, React 19, raw CSS tokens ported 1:1 from the prototype)
- **Backend** — NestJS 11 + Prisma 6 + Postgres 16 (+ optional pgvector)
- **Realtime** — Socket.IO
- **Agent RAG** — Claude + OpenAI embeddings + Pinecone (with a keyword-search fallback)
- **Billing** — Stripe (Checkout + Portal + Webhooks)
- **Analytics** — Mixpanel (gated by cookie consent)
- **Admin** — full `/admin` backoffice (accounts, workspaces, billing, events)
- **Auth** — argon2 + JWT cookie · Google & GitHub OAuth · degrades to mock when env unset

## Monorepo

```
apps/
  api/     NestJS backend  (port 3333, global prefix /api)
  web/     Next.js frontend (port 3000)
packages/
  api-types/   Shared Zod DTOs
```

---

## Run it locally

### 1. Clone & install
```bash
pnpm install
```

### 2. Start Postgres (and optional Redis)
```bash
docker compose up -d postgres redis
```
Or point `DATABASE_URL` at any existing Postgres.

### 3. Configure env
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```
Edit each if needed. **All third-party keys are optional** — the app runs
with zero external services; integrations activate as you add keys.

### 4. Initialise the database
```bash
pnpm --filter @tellar/api prisma generate
pnpm --filter @tellar/api prisma db push
pnpm --filter @tellar/api db:seed
```

### 5. Boot everything
```bash
pnpm dev
```

- Web → <http://localhost:3000>
- API → <http://localhost:3333/api>
- WS  → ws://localhost:3333/ws

### 6. Log in as the demo admin
Email `martin@tellar.studio` · password `demo1234`.
This account is an admin, so you'll also see the **Backoffice** link in the avatar menu → <http://localhost:3000/admin>.

### 7. See the viewer
The seeded share is live at <http://localhost:3000/v/qa09fx2>.
Enter any `@sequoiacap.com`, `@a16z.com`, `@indexventures.com` or `@accel.com`
email to pass the gate.

---

## Backoffice

Any user with `role === 'ADMIN'` can access:

| Page | What's there |
| --- | --- |
| `/admin` | KPIs: users, active users, workspaces, tellers, active shares, active subs, MRR, agent queries |
| `/admin/accounts` | Search users · promote / demote admin · suspend / unsuspend |
| `/admin/workspaces` | Workspaces, plan, seats, teller counts |
| `/admin/billing` | Subscriptions and invoice roll-up, paid revenue |
| `/admin/events` | Recent platform events (filterable by type) |

The admin API lives under `/api/admin/*` and is guarded by `JwtGuard + AdminGuard`.

---

## Environment variables cheat-sheet

### Required
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — any random string

### Optional — turning on features
| Feature | Env vars |
| --- | --- |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| GitHub OAuth | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Claude agent (real) | `ANTHROPIC_API_KEY` |
| OpenAI embeddings | `OPENAI_API_KEY` |
| Pinecone vector DB | `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` |
| Stripe billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE` |
| Mixpanel analytics | `NEXT_PUBLIC_MIXPANEL_TOKEN` (web) |

With nothing set: RAG uses keyword scoring, Stripe checkout flips the plan
locally, OAuth creates a dev-only mock user, Mixpanel stays inert.

---

## Scripts

```bash
pnpm dev                           # boot web + api in parallel
pnpm --filter @tellar/api db:seed  # (re)seed demo data
pnpm --filter @tellar/api db:reindex            # rebuild Pinecone index (no-op if unset)
pnpm --filter @tellar/api test:cov              # jest with coverage
docker compose up -d postgres redis             # infra
```

---

## CI/CD

- `.github/workflows/ci.yml` — on every push/PR: install, prisma generate, db push,
  typecheck, test:cov, build both apps, upload coverage artifact.
- `.github/workflows/cd.yml` — on `main`: build & push two images (`api`, `web`) to
  ECR, deploy to ECS, run `prisma migrate deploy` as a one-off task, Slack on failure.

The ECS task definitions (`aws/task-definition-{api,web}.json`) and the Prisma
migrate task need to exist on your AWS side — the workflow expects them, but
doesn't create them.

### Rollback
```bash
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE_API \
  --task-definition $PREVIOUS_TASK_DEF_ARN
```

---

## GDPR

- Cookie consent banner in `components/CookieBanner.tsx` — blocks Mixpanel until opt-in
- `GET /api/user/data-export` — download every record joinable to your user id
- `DELETE /api/user/account` — soft-delete flag; 30-day cool-off, then hard delete
- Privacy policy `/privacy`, cookie policy `/cookies`

---

## Architectural notes (deltas from CLAUDE.md's blueprint)

- **Database is Postgres, not PlanetScale MySQL.** The handoff (`docs/handoff.html`)
  specifies Postgres + pgvector for the agent; migrating to MySQL would sacrifice
  the RAG pipeline the product depends on. Pinecone handles vectors in prod.
- **Auth is NestJS-native JWT, not NextAuth.** Both SSR (Next RSC) and CSR consume
  the same `/api/auth/*` endpoints so the session model is a single source of truth.
- **Tests are targeted, not 100%.** CI runs `jest --coverage` and surfaces the
  number; it does not gate commits on 100% in this repo yet.

Everything else mirrors the CLAUDE.md blueprint — rate-limited Copilot & Ask,
Stripe Checkout + Portal + webhooks, GDPR endpoints, cookie-gated Mixpanel,
ECR/ECS deploy.

---

## Troubleshooting

- **`pnpm install` fails** — you need pnpm 9+. `corepack enable && corepack prepare pnpm@9.12.0 --activate`
- **Prisma errors about pgvector** — pgvector is optional in this repo; the schema
  does not declare `Unsupported("vector(...)")` by default. If you want real pgvector
  similarity, run `CREATE EXTENSION vector` in your DB, then add the column and index.
- **Blank dashboard** — the seed needs to run first (`pnpm --filter @tellar/api db:seed`).
- **OAuth button does nothing** — without `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID`
  the endpoint returns a dev-only mock user. Add the env vars to turn on real OAuth.

---

## Demo credentials
- `martin@tellar.studio` / `demo1234` (admin)
- Demo teller: `Q2 Series A pitch`
- Demo share slug: `/v/qa09fx2`
