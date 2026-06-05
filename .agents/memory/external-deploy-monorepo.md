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

**Object-path contract (avoid double `/objects/`).** The stored `objectPath` from
`getUploadUrl` ALREADY includes the `/objects/` prefix (e.g.
`/objects/uploads/<uuid>`), and the serving route `GET /api/storage/objects/*path`
re-adds `/objects/` to the captured wildcard. So the correct fetch URL is
`/api/storage${objectPath}` — NOT `/api/storage/objects${objectPath}` (that
double-prefixes to `/objects/objects/...` → wrong key → 404). **Why:** this bug was
latent for ages because completed jobs always had `outputObjectPath: null`, so the
media `<video>/<img>` and download link never rendered; it only surfaced once the
job pipeline started emitting a real output path.

**No real AI transform (free-tier).** AnimeMorph has no GPU/AI worker; the job
pipeline only simulates progress. On the free-tier deploy the "result" is set to
the original uploaded file (`outputObjectPath = inputObjectPath`) so it's
viewable/downloadable, with a UI note that AI styling isn't applied. Real anime
conversion would need a paid AI service.

**Single-service deploy: the Express API serves the React build.** Off-Replit
(e.g. Render free tier) the simplest topology is ONE web service: the API serves
`anime-morph/dist/public` as static + an SPA fallback in production, so one origin
answers both `/api/*` and the SPA. The frontend then calls the API with relative
`/api/...` (leave `VITE_API_BASE_URL` unset) — no CORS, no second service.
**Why:** the root build (`pnpm run build`) compiles both artifacts, so the client
dist is already present next to the API bundle at runtime.

**External-deploy sharp edges learned:**
- The host's build command must run the FULL build (`pnpm run build`), not
  `--filter api-server` only, or the frontend dist won't exist to serve.
- Locate the client dist via the API bundle, not cwd: at runtime `__dirname`
  (esbuild banner) = `artifacts/api-server/dist`, so client = `../../anime-morph/dist/public`.
- **Express 5 SPA fallback:** `app.get("/*splat", …)` matches `/apiary` but NOT
  the bare root `/`. Use a plain `app.use` middleware (filter to GET/HEAD, exclude
  `/api`) instead so `/` is covered.
- Exclude API paths with `req.path === "/api" || startsWith("/api/")`, not a bare
  `startsWith("/api")` (which also swallows `/apiary`).
- Render's **External** Postgres URL requires SSL; the runtime `pg` Pool sets no
  SSL, so the API service MUST use the **Internal** URL. For a one-off
  `drizzle-kit push` from outside Render, append `?sslmode=no-verify` to the URL
  or it hangs forever at "Pulling schema".
