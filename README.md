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
| Claude agent (cloud) | `ANTHROPIC_API_KEY` |
| OpenAI agent/embeddings (cloud) | `OPENAI_API_KEY` |
| **Self-hosted LLM (Ollama / vLLM)** | `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_EMBED_MODEL` |
| Pinecone vector DB | `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` |
| Stripe billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE` |
| Mixpanel analytics | `NEXT_PUBLIC_MIXPANEL_TOKEN` (web) |

With nothing set: RAG uses keyword scoring, Stripe checkout flips the plan
locally, OAuth creates a dev-only mock user, Mixpanel stays inert.

---

## Running with a local LLM (Ollama)

Tellar can talk to any OpenAI-compatible inference server instead of the
Anthropic / OpenAI cloud APIs. This is how you turn on the agent + copilot
without spending a cent per token and without any data leaving your machine.

### Option 1 — native Ollama (simplest on macOS / Linux)

```bash
brew install ollama                 # macOS, or curl -fsSL https://ollama.com/install.sh | sh
ollama serve &                      # keeps running in the background, port 11434
ollama pull qwen2.5:7b-instruct     # ~5 GB chat model
ollama pull nomic-embed-text        # ~275 MB embedding model (optional, for KB)
```

Then in `apps/api/.env`:

```bash
OPENAI_BASE_URL="http://localhost:11434/v1"
OPENAI_MODEL="qwen2.5:7b-instruct"
OPENAI_EMBED_MODEL="nomic-embed-text"
OPENAI_API_KEY="ollama-placeholder"   # required by the SDK, Ollama ignores it
```

Restart the API. On boot you'll see a log line:

```
[agent] chat backend = openai:qwen2.5:7b-instruct (custom base)
```

### Option 2 — Ollama in Docker (portable)

```bash
docker compose -f docker-compose.ollama.yml up -d
```

Runs the `ollama/ollama` image on port 11434, with a one-shot `ollama-pull`
side-car that downloads `qwen2.5:7b-instruct` + `nomic-embed-text` on first
boot. Override models via env:

```bash
OLLAMA_CHAT_MODEL=qwen2.5:14b-instruct \
  docker compose -f docker-compose.ollama.yml up -d
```

Then use the same `OPENAI_BASE_URL="http://localhost:11434/v1"` in the API
env.

### Option 3 — Production (AWS via CDK)

`infra/lib/stacks/ollama-stack.ts` ships a CDK stack that runs Ollama on a
single GPU EC2 instance inside the VPC. To enable it, set the `ollama` block
in `infra/lib/config.ts`:

```ts
export const staging: AppConfig = {
  // ...
  ollama: {
    instanceType: 'g5.xlarge',        // or g4dn.xlarge (~$380/mo) or t3.xlarge (CPU)
    chatModel: 'qwen2.5:7b-instruct',
    embedModel: 'nomic-embed-text',
    diskGiB: 120,
  },
};
```

Then `cd infra && pnpm cdk deploy --all`. The stack publishes the URL under
`/tellar/<env>/OPENAI_BASE_URL` in SSM Parameter Store and the Fargate task
automatically picks it up on next redeploy. Leave `ollama` unset and the
stack isn't created — no GPU cost.

### Backend precedence

When the API boots it picks one backend in this order:
1. `LLM_BACKEND=openai|anthropic` hard override.
2. `OPENAI_BASE_URL` set → local LLM (wins over any Anthropic key).
3. `ANTHROPIC_API_KEY` set → Claude.
4. `OPENAI_API_KEY` set → OpenAI cloud.
5. None set → deterministic mock responder (still useful for demos).

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
