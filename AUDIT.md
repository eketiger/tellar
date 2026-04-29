# Tellar — Codebase Audit (claude/codebase-audit-refactor-8ukXe)

This document is the running log for the audit / refactor / Anthropic
hardening branch. Items marked `✓` are shipped on this branch; `→`
items remain queued for follow-up PRs.

## Reliability

- ✓ **Rate-limit on `/v/:slug/authorize`.** Dual buckets (per-IP+slug,
  per-slug global) defend against passphrase brute-force without
  punishing a real visitor fixing a typo. Returns `429 { reason:
  rate-limited, retryAfterSec: 60 }`.
- ✓ **Stripe webhook signature.** Removed the silent `JSON.stringify`
  fallback that would always fail HMAC verification anyway and
  obscured root cause. Now fails loudly on missing raw body.
- ✓ **Realtime CORS.** Socket.IO gateway accepts `VIEWER_ORIGIN` so
  the viewer subdomain can establish the live presence channel.
- ✓ **GDPR sweeper.** `POST /api/admin/gdpr/sweep` (PlatformAdminGuard)
  PII-scrubs users past the 30-day cool-off — keeps the row as a
  tombstone so workspaces / memberships stay valid, deletes
  identifiable child data (sessions, cookieConsent, tellerAsk,
  copilotUsage, askUsage).
- → **Sweeper schedule.** Daily cron via EventBridge in CDK is the
  natural follow-up; for now the endpoint is callable manually.

## Security

- ✓ **Argon2 superadmin.** `SUPERADMIN_PASSWORD_HASH` (argon2id)
  preferred; plaintext fallback compared in constant time.
  Per-IP rate-limit on `/api/superadmin/login` (5/min).
- ✓ **CORS allow-list.** Now also reads `VIEWER_ORIGIN`; explicit
  `allowedHeaders` so `x-share-token` survives cross-origin viewer
  calls. Origins lower-cased + de-duped.
- ✓ **Stripe signature.** See above.
- ✓ **Per-tenant authoring guard.** `AuthoringService` double-checks
  `teller.workspaceId === u.ws` before any mutation, in addition to
  the `WorkspaceGuard` on the controller.
- → **Backoffice token storage.** Bearer in `localStorage` is fine
  for the isolated origin; document in deploy notes that the host
  must set `X-Frame-Options: DENY` and not share a parent domain
  with embeddable surfaces.
- → **NDA gate persistence** stays `sessionStorage` — intentional
  UX (one-shot per browser session). Audit row lives server-side.

## Performance

- ✓ **Content-hash short-circuit on `indexTeller`.** New
  `Teller.vectorContentHash` (SHA-256 of bundle text). Repeat
  saves with unchanged content skip the entire embed → upsert
  pipeline. `force: true` overrides for explicit reindex.
- ✓ **Viewer image lazy-load.** Slide images get `loading="lazy"`
  and `decoding="async"`; the next 1-2 slides are prefetched
  off-DOM so transitions feel instant.
- ✓ **next/font.** Replaced `@import url(google fonts)` with
  `next/font/google`. Self-hosted, preload-tagged woff2; saves
  ~150ms render-blocking on cold loads. Same change in
  apps/backoffice.
- ✓ **Server-side accounts pagination.** `AccountsClient` now uses
  the existing `?page=N` API endpoint instead of pulling every user
  client-side.
- ✓ **Prompt caching for Anthropic.** All Claude calls go through
  `ChatBackend.completeRich()` which marks the system prompt as
  ephemeral-cache. Insights ships persona + deck-structure as two
  cache breakpoints so per-deck repeat queries hit cache.
- → **Pinecone Redis cache for `similarTellers`.** Wire when
  `REDIS_URL` is set.

## Refactors

- ✓ **Anthropic-only AI.** OpenAI/Ollama paths gone from
  `chat-backend.ts`. `openai` SDK dropped from `apps/api/package.json`.
  Voyage AI is the embeddings provider.
- ✓ **Ollama infra removed.** Deleted `OllamaStack`,
  `docker-compose.ollama.yml`, the `cfg.ollama` branch in
  `infra/bin/app.ts`, and `OPENAI_*` env wiring in `ecs-stack`.
  Added `voyage-api-key` secret.
- ✓ **3-app split docs.** `middleware.ts` enforces console / viewer
  hostnames; backoffice lives in `apps/backoffice` with its own
  origin and bearer auth. Pure resolver in `lib/subdomain-router.ts`.
- ✓ **Light theme.** `html[data-theme='light']` token sets in
  console + backoffice; `ThemeToggle` with pre-paint bootstrap.
- ✓ **Shared UI primitives.** `components/ui/` → Panel,
  SectionHead, Kpi, Skeleton{Line,Rect,Card}. Replaces copy-pasted
  versions across dashboard / admin / settings / backoffice.
- ✓ **Command palette.** Global `⌘K` / Ctrl+K palette mounted in
  RootLayout. `CommandPalette.tsx` accepts `extraActions` for
  page-specific commands.
- → **Split `agent.service.ts`** (250+ lines: ask + copilot + rate
  limiting). Preserved as one file because the split would conflict
  with the new authoring/insights services until the second wave
  lands.
- → **Split `ViewerClient.tsx`** (~590 lines). Same reason: this PR
  already touches the viewer for lazy-load + slide-ref refs, and the
  extracted children deserve their own PR.

## UI improvements shipped

- ✓ **Light theme + persistent toggle** with no FOUC.
- ✓ **WCAG 2.4.7 focus rings** via `:focus-visible` on every
  interactive element. `prefers-reduced-motion` respected for the
  skeleton shimmer.
- ✓ **LIVE topbar dot wired to socket state.** `useRealtimePresence`
  hook listens to `connect`/`disconnect` + `live:count` ticks; the
  dot greys out and reads "OFFLINE" when the websocket drops.
- ✓ **Skeletons** in components/ui (used by ClaudeInsights;
  available to dashboards / settings going forward).
- ✓ **Command palette** with quick-nav actions + search.

## AI features (Anthropic)

- ✓ **Insights engine** at `GET /api/tellers/:id/insights`. Sends
  cached persona + cached deck structure + fresh analytics. Returns
  `{ summary, insights[], usage }` with insights typed
  `win | risk | recommendation | observation` and slide-anchored.
  Defensive JSON parser with deterministic mock fallback.
  Surfaced in the dashboard's `ClaudeInsights` panel including
  token-usage transparency (input / output / cached read).
- ✓ **Authoring agent** at `POST /api/tellers/:id/authoring/chat`.
  Conversational tellar editor via Claude tool-use. Tools:
  `list_slides`, `add_slide`, `update_slide`, `delete_slide`,
  `reorder_slides`. The agent loop is server-side, capped at 8
  iterations, every tool call is workspace-scoped.
- ✓ **Editor agent tab** with `AuthoringPanel.tsx` — chat history,
  tool-call trace, suggested prompts, fallback indicator, and
  `router.refresh()` on successful edits so the editor sees the
  changes immediately.
- ✓ **Best practices applied across every Claude call**:
  - Prompt caching (SystemBlock[] with `cache_control: ephemeral`).
  - Retries with exponential backoff on transient HTTP errors.
  - Structured output with tolerant parsing.
  - Tool-use orchestration with stop_reason loop.
  - Mock fallback so the app boots with no API key.

## Test coverage

API: 13 suites · 54 tests. All green.

New on this branch:
- `apps/api/src/agent/chat-backend.spec.ts` — Anthropic invariants,
  caching shape, retry-on-529, no-retry-on-400.
- `apps/api/src/agent/embeddings.spec.ts` — Voyage call path,
  empty-batch / no-key / HTTP-error fallback.
- `apps/api/src/viewer/viewer.controller.spec.ts` — per-IP and
  IP-isolation rate-limit invariants.
- `apps/api/src/superadmin/superadmin.controller.spec.ts` — argon2
  verify, plaintext fallback, IP rate-limit.
- `apps/api/src/insights/insights.service.spec.ts` — JSON parser
  matrix.
- `apps/api/src/authoring/authoring.service.spec.ts` — mock fallback
  + cross-workspace rejection + missing-teller rejection.
- `apps/web/lib/subdomain-router.spec.ts` — host/path resolution.
- `apps/web/lib/sanitize.spec.ts` (pre-existing).

## Operational follow-ups

1. Drop `openai` from `pnpm-lock.yaml` (lockfile regen — left to the
   maintainer's pnpm install run).
2. Add `TELLAR_CONSOLE_HOST` / `TELLAR_VIEWER_HOST` to the CDN stack
   so CloudFront forwards both Host headers to the ALB.
3. EventBridge daily rule for the GDPR sweeper.
4. Split `agent.service.ts` and `ViewerClient.tsx` once this PR lands.
5. Voyage AI secret population: rotate `voyage-api-key` in Secrets
   Manager before flipping vectors on in production.
