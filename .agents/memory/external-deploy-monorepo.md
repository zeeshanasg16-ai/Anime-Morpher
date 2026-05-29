---
name: External deploy of this monorepo (Render/Vercel/etc.)
description: Pitfalls when deploying this pnpm monorepo outside Replit via a root `pnpm run build`.
---

# Deploying this monorepo outside Replit

**Replit-only dev artifacts break a root `pnpm run build`.** `artifacts/mockup-sandbox`
(the canvas/component preview tool) is dev-only and its `vite.config.ts` used to
`throw` when `PORT`/`BASE_PATH` were unset. A recursive build (`pnpm -r run build`,
which Render's `pnpm run build` triggers) then fails on a service that is never
deployed.

**Why:** External hosts don't set Replit's per-artifact `PORT`/`BASE_PATH` env vars
at build time.

**How to apply:** Either (preferred) make dev-artifact vite configs default `PORT`/
`BASE_PATH` instead of throwing, or give the host a per-service build command that
filters to just the deployed artifact (`pnpm --filter @workspace/<slug> run build`).

**Replit object storage does NOT work off-Replit.** `api-server/src/lib/objectStorage.ts`
authenticates via the Replit sidecar at `http://127.0.0.1:1106`, which only exists
inside Replit. Any external deploy must swap to real GCS service-account creds or
an S3-compatible store (e.g. Cloudflare R2) — no URL change fixes it.
