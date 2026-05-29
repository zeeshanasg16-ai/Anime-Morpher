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

**Replit object storage does NOT work off-Replit.** The old `objectStorage.ts`
authenticated via the Replit sidecar at `http://127.0.0.1:1106`, which only exists
inside Replit. No URL change fixes it.

**Resolved: storage is now Cloudflare R2 (S3-compatible).** `objectStorage.ts` uses
`@aws-sdk/client-s3` + `s3-request-presigner`: client requests a presigned PUT URL,
uploads directly to R2, persists `objectPath` `/objects/uploads/<uuid>`, and the API
streams objects back via `GetObjectCommand`. Requires env `R2_ACCOUNT_ID`,
`R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` on the API service.

**R2 gotchas:** (1) The bucket needs a CORS policy (AllowedOrigins = the live
frontend origin, AllowedMethods PUT/GET, AllowedHeaders `*`) or browser uploads
fail. (2) Upload-URL issuance is anonymous — enforce a server-side size ceiling
(`MAX_UPLOAD_BYTES`) since client-provided metadata is untrusted.
