# Tellar

> Presentations that know when they lose you.

Full-stack implementation of the Tellar handoff spec: **DocSend × Loom × AI agents**.
Share decks that track per-slide drop-off, record narration, and answer viewer
questions from your knowledge base.

- **Frontend** — Next.js 15 (App Router, React 19, raw CSS tokens ported 1:1 from the prototype)
- **Backend** — NestJS 11 + Prisma 6 + **PlanetScale (MySQL)**
- **Realtime** — Socket.IO
- **Agent RAG** — Claude + OpenAI embeddings + Pinecone (with a keyword-search fallback)
- **Billing** — Stripe (Checkout + Portal + Webhooks)
- **Analytics** — Mixpanel (gated by cookie consent)
- **Admin** — full `/admin` backoffice (accounts, workspaces, billing, events)
- **Auth** — argon2 + JWT cookie · Google & GitHub OAuth · degrades to mock when env unset
- **Docs** — Fumadocs at `/docs` + `/help`; Scalar at `/api-reference`; OpenAPI 3.1 at `/openapi.yaml`
- **Infra** — AWS CDK in `infra/` (VPC, ECR, ECS/Fargate, ALB, CloudFront, monitoring, OIDC IAM role)

## Monorepo

```
apps/
  api/           NestJS backend  (port 3333, global prefix /api)
  web/           Next.js frontend (port 3000)
packages/
  api-types/     Shared Zod DTOs
infra/           AWS CDK v2 stacks
```

---

## Run it locally

### 1. Clone & install
```bash
pnpm install
```

### 2. Start MySQL (and optional Redis)

You have two options:

**A. Local MySQL 8 via Docker** (works offline, no PlanetScale account needed)
```bash
docker compose up -d mysql redis
```

**B. PlanetScale dev branch** (recommended for team work)
- Create a database on <https://planetscale.com>, then a `dev` branch.
- `pscale connect tellar dev --port 3306` in one terminal to tunnel it locally.
- Or grab the direct connection string from the PlanetScale console.

### 3. Configure env
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Set `DATABASE_URL` to your MySQL connection string:
- Local MySQL: `mysql://tellar:tellar@localhost:3306/tellar`
- PlanetScale: `mysql://USER:PASS@aws.connect.psdb.cloud/tellar?sslaccept=strict`

**All other third-party keys are optional** — the app runs with zero external
services; integrations activate as you add keys (see table below).

### 4. Push the schema & seed
```bash
pnpm --filter @tellar/api db:generate
pnpm --filter @tellar/api db:push
pnpm --filter @tellar/api db:seed
```

PlanetScale workflow note: we use `prisma db push` against a dev branch, never
`prisma migrate`. Schema changes ship by merging a PlanetScale deploy request.

### 5. Boot everything
```bash
pnpm dev
```

| URL | Page |
| --- | --- |
| <http://localhost:3000> | Marketing home |
| <http://localhost:3000/dashboard> | Studio (after login) |
| <http://localhost:3000/admin> | Backoffice (admin-only) |
| <http://localhost:3000/docs> | Product docs (Fumadocs) |
| <http://localhost:3000/help> | Help center (Fumadocs) |
| <http://localhost:3000/api-reference> | Interactive API reference (Scalar) |
| <http://localhost:3000/openapi.yaml> | Raw OpenAPI 3.1 spec |
| <http://localhost:3000/v/qa09fx2> | Seeded viewer demo |
| <http://localhost:3333/api/health> | Backend health check |

Demo login: `martin@tellar.studio` / `demo1234` (admin).

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
- `DATABASE_URL` — PlanetScale or local MySQL connection string
- `JWT_SECRET` — any random string

### Optional — turning on features
| Feature | Env vars |
| --- | --- |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| GitHub OAuth | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Claude (chat / agent / copilot / insights / authoring) | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Voyage embeddings (Anthropic's recommended partner) | `VOYAGE_API_KEY`, `VOYAGE_EMBED_MODEL` |
| Pinecone vector DB | `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` |
| Stripe billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE` |
| Mixpanel analytics | `NEXT_PUBLIC_MIXPANEL_TOKEN` (web) |

With nothing set: agent / copilot / insights fall back to deterministic mocks
and the KB switches to keyword scoring. Stripe checkout flips the plan locally,
OAuth creates a dev-only mock user, Mixpanel stays inert.

---

## AI backend (Anthropic-only)

All chat / agent / copilot / insights / authoring paths go through Claude.
Set `ANTHROPIC_API_KEY` to enable real responses; without it the API
returns deterministic mock answers so the rest of the app stays usable in
local dev. Embeddings (optional, for vector retrieval) are powered by
Voyage AI — Anthropic's recommended embeddings partner. Without it, the
KB retriever falls back to keyword scoring.

```bash
ANTHROPIC_API_KEY="sk-ant-…"
ANTHROPIC_MODEL=""              # default: claude-sonnet-4-20250514
VOYAGE_API_KEY=""               # optional, for vector retrieval
VOYAGE_EMBED_MODEL=""           # default: voyage-3
```

---

## Scripts

```bash
pnpm dev                                    # boot web + api in parallel
pnpm --filter @tellar/api db:push           # push schema to the current MySQL
pnpm --filter @tellar/api db:generate       # regenerate Prisma client
pnpm --filter @tellar/api db:studio         # Prisma Studio
pnpm --filter @tellar/api db:seed           # (re)seed demo data
pnpm --filter @tellar/api test:cov          # jest with coverage
docker compose up -d mysql redis            # local infra
```

---

## CI/CD

- `.github/workflows/ci.yml` — on every push/PR: install, prisma generate, db push,
  typecheck, test:cov, build both apps, upload coverage, Redocly lint `openapi.yaml`,
  `cdk synth` + `jest` inside `infra/`.
- `.github/workflows/cd.yml` — on `main`, OIDC-only (`AWS_ROLE_ARN` secret):
  build & push two images (`api`, `web`) to ECR, deploy to ECS, run
  `prisma db push --accept-data-loss` as a one-off Fargate task, Slack on failure.

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

- **Auth is NestJS-native JWT, not NextAuth.** Both SSR (Next RSC) and CSR consume
  the same `/api/auth/*` endpoints so the session model is a single source of truth.
  Google/GitHub OAuth are implemented directly against each provider's token endpoint
  behind env flags.
- **Tests are targeted, not 100%.** CI runs `jest --coverage` and surfaces the
  number; it does not gate commits on 100% in this repo yet.

Everything else mirrors the CLAUDE.md blueprint — PlanetScale + Prisma
(`relationMode = "prisma"`, no foreign keys, indexed FK columns, `db push`
workflow), rate-limited Copilot & Ask, Stripe Checkout + Portal + webhooks,
GDPR endpoints, cookie-gated Mixpanel, Pinecone + OpenAI embeddings,
ECR/ECS deploy via OIDC.

---

## Troubleshooting

- **`pnpm install` fails** — you need pnpm 9+. `corepack enable && corepack prepare pnpm@9.12.0 --activate`
- **Prisma complains about foreign keys** — expected on PlanetScale. The schema uses
  `relationMode = "prisma"` and every relation column has an `@@index(...)`.
- **`db push` errors with data loss** — PlanetScale requires `--accept-data-loss`
  when dropping/renaming. The CI/CD pipeline does this automatically on `main`.
- **Blank dashboard** — the seed needs to run first (`pnpm --filter @tellar/api db:seed`).
- **OAuth button does nothing** — without `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID`
  the endpoint returns a dev-only mock user. Add the env vars to turn on real OAuth.

---

## Demo credentials
- `martin@tellar.studio` / `demo1234` (admin)
- Demo teller: `Q2 Series A pitch`
- Demo share slug: `/v/qa09fx2`
