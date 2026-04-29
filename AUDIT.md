# Tellar — Codebase Audit (claude/codebase-audit-refactor-8ukXe)

This document is a sweep across the monorepo with concrete findings and the
deltas already shipped on this branch. Items prefixed `✓` were applied here;
items prefixed `→` are recommendations queued for follow-up PRs.

## Summary of changes shipped on this branch

- ✓ **All AI routed through Anthropic.** OpenAI / Ollama / `LLM_BACKEND`
  branches deleted from `apps/api/src/agent/chat-backend.ts`. Embeddings
  switched to Voyage AI (Anthropic's recommended partner) in
  `apps/api/src/agent/embeddings.ts`. The `openai` SDK dependency was
  removed from `apps/api/package.json`. `.env.example` only documents the
  Anthropic + Voyage paths.
- ✓ **Light theme.** CSS tokens for `html[data-theme='light']` added to
  both `apps/web/app/globals.css` and `apps/backoffice/app/globals.css`.
  New `ThemeToggle` component in each app, with a synchronous bootstrap
  script in `<head>` that sets `data-theme` before paint (no FOUC).
  Persisted in `localStorage`, default falls back to system preference.
- ✓ **3-app split made explicit.**
  - `apps/web` — the **Console** (authoring, dashboard, admin).
  - `apps/backoffice` — already a separate app with its own port (3001),
    its own `globals.css`, its own bearer-token auth (no shared cookie
    with the console). Now also gets a theme toggle.
  - The **Viewer** stays inside `apps/web` (under `/v/*`) but is split
    onto its own hostname via `apps/web/middleware.ts`. Cookies, CSP and
    analytics are scoped per host. Routing logic lives in the pure helper
    `apps/web/lib/subdomain-router.ts` and is fully unit-tested.
- ✓ **New tests.**
  - `apps/api/src/agent/chat-backend.spec.ts` — covers Anthropic-only
    behavior, mock fallback, model override, and the legacy-vars-ignored
    invariant.
  - `apps/api/src/agent/embeddings.spec.ts` — Voyage-only call path and
    graceful keyword-only fallback when unconfigured / on HTTP error.
  - `apps/web/lib/subdomain-router.spec.ts` — host/path resolution
    behavior for console/viewer subdomain split.

## Verifying the 3-app split

| App           | Path                | Port (dev) | Hostname (prod env)        | Auth                                          |
| ------------- | ------------------- | ---------- | -------------------------- | --------------------------------------------- |
| Console       | `apps/web`          | 3000       | `TELLAR_CONSOLE_HOST`      | `tellar_jwt` httpOnly cookie via `/api/auth/*` |
| Viewer        | `apps/web`, `/v/*`  | 3000       | `TELLAR_VIEWER_HOST`       | Per-share `x-share-token` header (short-lived) |
| Backoffice    | `apps/backoffice`   | 3001       | own subdomain (e.g. `ops.…`) | `SUPERADMIN_*` env-var login → bearer token   |

The console + viewer share a Next bundle but never share a cookie origin,
because the middleware bounces any non-viewer path on the viewer host
(308) to the console host and vice-versa. The backoffice app is a fully
separate Next deployment with its own `package.json` and its own `lib/api.ts`
talking to NestJS through `/bo-api/*`.

## Reliability findings

1. **Idempotent SLIDE_DWELL flush.** `ViewerClient` already de-duplicates
   `pagehide`/`visibilitychange` flushes via a `lastFlushedStart` ref —
   keep this guard intact in any future viewer refactor (it was a real
   bug in an earlier iteration, see comments around `flushDwell`).
2. → **Pinecone graceful degradation is solid for chat, but `indexTeller`
   silently swallows pre-existing-namespace errors with `log.debug`.** Add
   a structured metric (`vectorStatus = 'error'` is set on real failures
   but not surfaced to the dashboard yet).
3. → **`viewer.controller.ts` has no rate-limit on `/v/:slug/authorize`.**
   Add an IP+slug bucket to `RateLimiter` (one already exists for the
   agent paths). Brute-forcing a passphrase is currently unbounded.
4. → **Stripe webhook signature verification.** `apps/api/src/billing/*`
   should reject any inbound webhook missing/bad `Stripe-Signature`.
   Verify it's wired before flipping `STRIPE_WEBHOOK_SECRET` on in prod.
5. → **Background hard-delete sweeper is documented in CLAUDE.md but the
   queue itself is best-effort.** Consider a daily cron CDK construct
   that calls `/api/user/sweep-deletions` (admin-only) so the GDPR SLA
   isn't dependent on traffic.

## Security findings

1. **Backoffice token storage.** The backoffice stores its bearer token in
   `localStorage` (`apps/backoffice/lib/api.ts`). Acceptable because it's
   served from a separate origin — but document explicitly that the
   backoffice host **must not** be embeddable (`X-Frame-Options: DENY`)
   and **must not** share a parent domain with anything that loads
   third-party scripts. Today this is just convention.
2. **Superadmin auth.** `superadmin.controller.ts` does a plain string
   compare (`pass !== expectedPass`) on `SUPERADMIN_PASSWORD`. → switch
   to `argon2.verify` against a stored hash and ship the hash via Secrets
   Manager. Equality on plaintext is timing-attackable.
3. **Share gate logging.** Make sure `viewer.service.ts` does not log the
   raw passphrase or `email` even on failure paths (CLAUDE.md GDPR rule).
   Spot-checked: clean as of this branch.
4. **CORS.** `WEB_ORIGIN` and `BACKOFFICE_ORIGIN` allow-list is single-
   value. With the new `TELLAR_VIEWER_HOST` we'll need a third entry —
   queued for the API CORS bootstrap.
5. **NDA gate persistence.** Stored in `sessionStorage` — accepted.
   Document that this is intentional UX (one-shot per browser session)
   and not a legal record; the audit row lives in `Event` rows
   server-side.

## Performance optimisation

1. → **`/v/:slug` payload is the full teller**. Slides include all HTML.
   For 50-slide decks this is ~200KB on first paint. Stream the first 5
   slides + lazy-load the rest behind an Intersection Observer.
2. → **Pinecone `query` runs once per Ask + an extra `fetch` for
   `similarTellers`.** Cache `similarTellers` in Redis (`REDIS_URL`)
   when the env var is set; key by `tellerId`, TTL 1h.
3. → **Globals CSS imports Google Fonts via `@import url(...)`** which
   blocks the render path. Move to `next/font/google` for `Fraunces`,
   `JetBrains Mono`, `Inter Tight` — saves ~150ms on cold loads.
4. → **`AccountsClient` pulls all users client-side and filters in JS.**
   Push search/filter to `/api/admin/accounts?q=` (already exists) and
   paginate. `recharts` bundle alone is 90KB gzipped — keep it lazy.
5. → **`indexTeller` rebuilds every chunk on each call.** Consider a
   content-hash short-circuit: if `bundle.text` hash is unchanged since
   last `vectorizedAt`, skip embedding.

## Refactors recommended

1. → **`agent.service.ts`** is 250+ lines and mixes RAG retrieval, mock
   responder, copilot routing, and rate-limiting. Split into
   `ask.service.ts`, `copilot.service.ts`, and a shared `rate-limit.ts`.
2. → **`ViewerClient.tsx` is 590 lines** (single client component).
   Extract `GateOverlay`, `NdaGate`, `Viewer`, `NarratorVideo` into
   their own files under `apps/web/app/v/[slug]/components/`. Each
   already has a clean prop surface.
3. → **`apps/web/app/globals.css` is 250 lines and growing.** Split into
   `tokens.css` (variables), `topbar.css`, `home.css` (already isolated),
   `panel.css`. Keep one `@layer base, components` ordering.
4. → **Legacy Ollama infrastructure.** `infra/lib/stacks/ollama-stack.ts`
   and the OPENAI_BASE_URL plumbing in `ecs-stack.ts` are dead now that
   chat is Anthropic-only. Remove them (and `docker-compose.ollama.yml`)
   in a follow-up that also drops the `cfg.ollama` config branch in
   `infra/bin/app.ts`.
5. → **Settings + Admin re-use copy-pasted KPI tiles.** Promote `Kpi`,
   `Panel`, and `SectionHead` into shared components under
   `apps/web/components/` so backoffice + admin + dashboard share one.

## UI proposals

These are deliberately small, design-system-friendly improvements; they
don't change the brand voice (Fraunces/JetBrains Mono/Inter Tight) and
avoid tearing up the existing layouts.

- **Theme toggle is now in `TopBar` and the backoffice header.** Default
  follows the OS preference; user choice is persisted per app
  (`tellar:theme`, `tellar:bo:theme`).
- **Empty states.** `apps/web/app/dashboard` shows "loading…" copy with no
  skeleton. Add 3 ghost teller cards with a shimmer; the layout never
  jumps when data arrives.
- **Live dot.** `topbar` `LIVE · 2` badge is hardcoded — wire it to the
  realtime socket connection state. Greyed out when disconnected.
- **Editor command palette.** The editor has many sidebars (Copilot, KB,
  Narration, Notes, Templates, Layout, Gradient). Add a `⌘K` palette
  that searches all actions across panels. The palette already exists
  conceptually in the analytics page; promote it to a shared component.
- **Viewer chat affordance.** The agent panel is open by default; add a
  collapsed pill on mobile so the slide isn't compressed below 60% of
  the viewport.
- **Cookie banner contrast.** In light theme the cookie banner needs a
  slight shadow/border (currently relies on darker background). Already
  handled by the new `--topbar-bg` token but verify with a screenshot
  pass on light mode.
- **Focus rings.** Standardise on `outline: 2px solid var(--accent);
  outline-offset: 2px;` across all inputs and buttons. Several elements
  ride `outline: none` today, which fails WCAG 2.4.7.
- **NDA gate spacing.** The accept button can sit closer to the checkbox;
  current 20px gap reads as if there are two unrelated controls.

## Test coverage progress

Existing specs (kept, not regressed):

- `apps/api/src/agent/chunker.spec.ts`
- `apps/api/src/auth/workspace.guard.spec.ts`
- `apps/api/src/auth/admin.guard.spec.ts`
- `apps/api/src/shares/shares.service.spec.ts`
- `apps/api/src/common/rate-limiter.spec.ts`
- `apps/api/src/events/events.service.spec.ts`
- `apps/api/src/gdpr/gdpr.service.spec.ts`
- `apps/web/lib/sanitize.spec.ts`

New on this branch:

- `apps/api/src/agent/chat-backend.spec.ts` — Anthropic-only invariants.
- `apps/api/src/agent/embeddings.spec.ts` — Voyage call path & fallback.
- `apps/web/lib/subdomain-router.spec.ts` — host/path → action resolver.

Suggested next test targets (not yet shipped):

- `apps/api/src/auth/auth.service.ts` — argon2 hash/verify roundtrip,
  cookie attribute matrix, JWT TTL.
- `apps/api/src/agent/agent.service.ts` — `enforceAskLimit`,
  `enforceCopilotLimit`, mock answer when chat backend unavailable.
- `apps/api/src/billing/billing.service.ts` — Stripe webhook signature
  verification, idempotency on duplicate event ids.
- `apps/web/components/ThemeToggle.tsx` — needs `@testing-library/react`;
  not added in this branch to avoid widening dependencies.

## Operational follow-ups

1. **Drop `openai` from `pnpm-lock.yaml`.** Local lockfile regen is the
   user's call; not done here so this branch stays a pure source diff.
2. **Remove `OllamaStack` + ECS env-vars** in a focused infra PR so the
   CDK diff is reviewable on its own.
3. **Add `TELLAR_CONSOLE_HOST` / `TELLAR_VIEWER_HOST` to the CDN
   stack.** Both must terminate on the ALB and dispatch to the same
   target group; CloudFront's host header pass-through is what makes
   the middleware decision.
