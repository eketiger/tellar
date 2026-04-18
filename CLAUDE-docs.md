# CLAUDE-docs.md — Documentation & Help Center instructions

> Companion to `CLAUDE.md`. Covers the docs site, help center, API guides, and API reference
> as implemented in this repo.

## Implementation summary

- `/docs` and `/help` are served by Fumadocs inside `apps/web`. Content lives in
  `apps/web/content/{docs,help}` as MDX, organised by `meta.json` files that control ordering.
- `/api/search` uses `fumadocs-core/search/server` to index both content trees.
- `/api-reference` is rendered by Scalar (`@scalar/nextjs-api-reference`) and reads the raw
  OpenAPI spec served at `/openapi.yaml`.
- `openapi.yaml` lives at the repo root and is the single source of truth for the API surface.
  CI lints it with `@redocly/cli`.

## File layout (inside `apps/web/`)

```
app/
  docs/
    layout.tsx            DocsLayout for Fumadocs
    [[...slug]]/page.tsx  Catch-all renderer
  help/
    layout.tsx
    [[...slug]]/page.tsx
  api-reference/route.ts  Scalar mount
  openapi.yaml/route.ts   Serves the raw YAML
  api/
    search/route.ts       Fumadocs search API
    health/route.ts       ALB + CloudFront health check

lib/docs-source.ts        Fumadocs loaders (docs + help)
source.config.ts          Fumadocs MDX config
content/
  docs/**                 MDX for docs
  help/**                 MDX for help center
```

## Authoring rules

1. Every MDX file starts with frontmatter `title` + `description`.
2. Every directory has a `meta.json` that lists the pages in the desired order.
3. Code samples use `fumadocs-ui/components/tabs` for multi-language toggles.
4. Help articles add a `category` frontmatter field for consistent filtering later.

## Next.js rewrites

`next.config.mjs` explicitly proxies only the backend-owned API paths to NestJS. This is
important because `/api/search`, `/api/health`, `/api/openapi.yaml`, and `/api-reference` are
**local** Next.js routes — they must not be rewritten to the backend.

When adding a new backend endpoint, add a matching rewrite source in `next.config.mjs`.

## OpenAPI updates

Changing any route in `apps/api`:
1. Edit `openapi.yaml` at the repo root to match.
2. CI runs `@redocly/cli lint openapi.yaml` — fix the spec if this fails.
3. `/api-reference` auto-reflects the new spec on the next deploy.

## Mixpanel events (frontend)

See `apps/web/lib/analytics.ts`. When adding docs navigation, fire:
- `Docs Page Viewed` `{ path, title, section: 'docs' | 'help' }`
- `Docs Search Performed` `{ query, results_count }`
- `Docs Search Result Clicked` `{ query, clicked_title, clicked_url }`

## Tests

- Snapshot `docsSource.generateParams()` and `helpSource.generateParams()` — every MDX must
  appear there.
- `/api/search` must return a non-empty result for a known keyword from quickstart.mdx.
- `/openapi.yaml` responds with `content-type: application/yaml` + status 200.
- `@redocly/cli lint openapi.yaml` is green in CI.
