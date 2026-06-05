---
name: GPU worker pull model
description: How AnimeMorph offloads heavy video→anime conversion to an external GPU worker, and the non-obvious server-side constraints.
---

# GPU worker pull model

AnimeMorph splits into a Render control plane (frontend + API + Postgres queue +
R2) and an external GPU worker (`worker/`, Python + ComfyUI) on a rented GPU.

## Decisions / constraints

- **Pull, not push.** Marketplace GPU boxes sit behind NAT with no stable inbound
  URL, so ALL worker↔app traffic is the worker calling the app. Never assume the
  app can reach the worker.
  **How to apply:** any new worker capability must be an endpoint the worker polls
  or posts to, gated by the shared-secret header.

- **Worker routes are deliberately OUT of the OpenAPI/codegen surface.** They live
  in `artifacts/api-server/src/routes/worker.ts`, are validated with local `zod/v4`
  schemas, and gated by `WORKER_TOKEN` (header `x-worker-token`, constant-time
  compare). The React client never calls them, so adding them to `openapi.yaml`
  would only generate dead hooks.
  **Why:** keeps the public client contract clean and avoids leaking internal ops.

- **Atomic claim + stale reclaim in one SQL statement.** `/worker/claim` uses a
  single `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)` that grabs the
  oldest `queued` job OR a `processing` job whose `updated_at` is older than
  `WORKER_STALE_MINUTES` (default 30). Staleness is keyed on `updated_at` (bumped
  by the progress endpoint via drizzle `$onUpdate`), NOT `started_at`, so a long
  but healthy job is not reclaimed mid-flight.
  **Why:** safe for multiple concurrent workers and auto-recovers crashed workers.

- **Worker holds no R2 creds.** The API hands it short-lived presigned GET (input)
  and PUT (output) URLs at claim time via `getDownloadUrl` / `getOutputUploadUrl`
  in `objectStorage.ts`. Output keys go under `outputs/<uuid>.<ext>`.

- **No simulated processing.** The old `simulateProcessing` (input-as-output
  fake) was removed; jobs now genuinely wait `queued` until a worker is online.

- `WORKER_TOKEN` is a secret set on Render (declared in `render.yaml`) and must
  match the worker's `.env`. When unset, all `/api/worker/*` return 503.
