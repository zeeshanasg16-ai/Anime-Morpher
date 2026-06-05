import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { z } from "zod/v4";
import { ObjectStorageService } from "../lib/objectStorage";

/**
 * Worker control-plane routes.
 *
 * These are server-to-server endpoints called only by the GPU worker (never by
 * the React client), so they are deliberately kept OUT of the OpenAPI/codegen
 * surface and validated with local Zod schemas. Every route is gated by a shared
 * secret (`WORKER_TOKEN`) compared in constant time.
 */

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// A `processing` job whose last update is older than this is considered stale
// (its worker likely crashed) and is eligible to be reclaimed by a new claim.
// Clamped to a sane range so a bad value can't cause immediate reclaim loops.
const STALE_MINUTES = clampNumber(process.env.WORKER_STALE_MINUTES, 30, 1, 1440);

// Lifetime of the presigned input/output URLs handed to the worker. Long enough
// for a multi-minute conversion plus upload of a large file (R2 caps at 7 days).
const SIGNED_URL_TTL_SECONDS = clampNumber(
  process.env.WORKER_SIGNED_URL_TTL_SECONDS,
  6 * 60 * 60,
  60,
  7 * 24 * 60 * 60,
);

// Constant-time secret comparison. Both sides are hashed first so the lengths
// fed to timingSafeEqual are always equal, avoiding a length side-channel.
function constantTimeEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

function requireWorkerToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.WORKER_TOKEN;
  if (!expected) {
    req.log.error("WORKER_TOKEN is not configured; rejecting worker request");
    res.status(503).json({ error: "Worker endpoints are not configured" });
    return;
  }
  const header = req.header("x-worker-token") ?? "";
  if (!constantTimeEqual(header, expected)) {
    res.status(401).json({ error: "Invalid worker token" });
    return;
  }
  next();
}

router.use("/worker", requireWorkerToken);

const ClaimBody = z.object({
  workerId: z.string().min(1).max(200),
});

const ProgressBody = z.object({
  workerId: z.string().min(1).max(200),
  progress: z.number().int().min(0).max(100),
});

const CompleteBody = z.object({
  workerId: z.string().min(1).max(200),
  outputObjectPath: z.string().startsWith("/objects/"),
  thumbnailObjectPath: z.string().startsWith("/objects/").optional(),
  durationSeconds: z.number().positive().optional(),
});

const FailBody = z.object({
  workerId: z.string().min(1).max(200),
  errorMessage: z.string().min(1).max(2000),
});

const JobIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * POST /worker/claim
 * Atomically claim the next available job. In a single statement this:
 *  - picks the oldest `queued` job, OR an old stale `processing` job, and
 *  - moves it to `processing` owned by this worker (FOR UPDATE SKIP LOCKED keeps
 *    concurrent workers from grabbing the same row).
 * Returns the job plus short-lived presigned URLs for the input (read) and a
 * freshly-minted output key (write). 204 when nothing is available.
 */
router.post("/worker/claim", async (req: Request, res: Response): Promise<void> => {
  const parsed = ClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { workerId } = parsed.data;

  // Raw SQL is required for the atomic FOR UPDATE SKIP LOCKED claim. It returns
  // raw snake_case columns, so we only read the id here and re-select the row
  // through Drizzle below to get a properly typed (camelCase) Job.
  const claimed = await db.execute<{ id: number }>(sql`
    UPDATE jobs SET
      status = 'processing',
      worker_id = ${workerId},
      started_at = now(),
      attempts = attempts + 1,
      progress = 0,
      error_message = null,
      updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'queued'
         OR (status = 'processing' AND updated_at < now() - make_interval(mins => ${STALE_MINUTES}))
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id;
  `);

  const claimedId = claimed.rows?.[0]?.id ?? null;
  if (claimedId == null) {
    res.sendStatus(204);
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, claimedId));
  if (!job) {
    res.sendStatus(204);
    return;
  }

  const outputExt = job.type === "video_morph" ? "mp4" : "png";
  const outputContentType = job.type === "video_morph" ? "video/mp4" : "image/png";

  try {
    const [inputUrl, output] = await Promise.all([
      objectStorageService.getDownloadUrl(job.inputObjectPath, SIGNED_URL_TTL_SECONDS),
      objectStorageService.getOutputUploadUrl(
        outputExt,
        outputContentType,
        SIGNED_URL_TTL_SECONDS,
      ),
    ]);

    res.json({
      job,
      input: { downloadURL: inputUrl },
      output: {
        uploadURL: output.uploadURL,
        objectPath: output.objectPath,
        contentType: outputContentType,
      },
    });
  } catch (error) {
    // If we cannot mint URLs the worker cannot proceed, so release the job back
    // to the queue rather than stranding it in `processing`.
    req.log.error({ err: error, jobId: job.id }, "Failed to mint worker URLs");
    await db
      .update(jobsTable)
      .set({ status: "queued", workerId: null, startedAt: null })
      .where(eq(jobsTable.id, job.id));
    res.status(500).json({ error: "Failed to prepare job for processing" });
  }
});

/**
 * POST /worker/jobs/:id/progress
 * Report incremental progress. Only the owning worker may update, and only while
 * the job is still `processing`.
 */
router.post(
  "/worker/jobs/:id/progress",
  async (req: Request, res: Response): Promise<void> => {
    const params = JobIdParams.safeParse(req.params);
    const body = ProgressBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [updated] = await db
      .update(jobsTable)
      .set({ progress: body.data.progress })
      .where(
        and(
          eq(jobsTable.id, params.data.id),
          eq(jobsTable.workerId, body.data.workerId),
          eq(jobsTable.status, "processing"),
        ),
      )
      .returning();

    if (!updated) {
      res.status(409).json({ error: "Job not owned by worker or not processing" });
      return;
    }
    res.json({ ok: true });
  },
);

/**
 * POST /worker/jobs/:id/complete
 * Mark a job done with its output path. Owner + processing guarded.
 */
router.post(
  "/worker/jobs/:id/complete",
  async (req: Request, res: Response): Promise<void> => {
    const params = JobIdParams.safeParse(req.params);
    const body = CompleteBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [updated] = await db
      .update(jobsTable)
      .set({
        status: "completed",
        progress: 100,
        outputObjectPath: body.data.outputObjectPath,
        thumbnailObjectPath: body.data.thumbnailObjectPath ?? null,
        durationSeconds: body.data.durationSeconds ?? null,
        errorMessage: null,
      })
      .where(
        and(
          eq(jobsTable.id, params.data.id),
          eq(jobsTable.workerId, body.data.workerId),
          eq(jobsTable.status, "processing"),
        ),
      )
      .returning();

    if (!updated) {
      res.status(409).json({ error: "Job not owned by worker or not processing" });
      return;
    }
    res.json(updated);
  },
);

/**
 * POST /worker/jobs/:id/fail
 * Mark a job failed with a message. Owner + processing guarded.
 */
router.post(
  "/worker/jobs/:id/fail",
  async (req: Request, res: Response): Promise<void> => {
    const params = JobIdParams.safeParse(req.params);
    const body = FailBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [updated] = await db
      .update(jobsTable)
      .set({ status: "failed", errorMessage: body.data.errorMessage })
      .where(
        and(
          eq(jobsTable.id, params.data.id),
          eq(jobsTable.workerId, body.data.workerId),
          eq(jobsTable.status, "processing"),
        ),
      )
      .returning();

    if (!updated) {
      res.status(409).json({ error: "Job not owned by worker or not processing" });
      return;
    }
    res.json(updated);
  },
);

export default router;
