import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import {
  CreateJobBody,
  ListJobsQueryParams,
  GetJobParams,
  DeleteJobParams,
  RetryJobParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Authentication has been removed. All jobs are owned by a single shared
// anonymous user so the existing per-user scoping logic keeps working.
const ANONYMOUS_USER_ID = "anonymous";

function requireAuth(req: any, _res: any, next: any): void {
  req.userId = ANONYMOUS_USER_ID;
  next();
}

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get("/jobs/stats", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;

  const rows = await db
    .select({
      status: jobsTable.status,
      type: jobsTable.type,
      cnt: count(),
    })
    .from(jobsTable)
    .where(eq(jobsTable.userId, userId))
    .groupBy(jobsTable.status, jobsTable.type);

  const stats = {
    total: 0,
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    videoMorphCount: 0,
    photoAnimateCount: 0,
  };

  for (const row of rows) {
    const n = Number(row.cnt);
    stats.total += n;
    if (row.status === "queued") stats.queued += n;
    if (row.status === "processing") stats.processing += n;
    if (row.status === "completed") stats.completed += n;
    if (row.status === "failed") stats.failed += n;
    if (row.type === "video_morph") stats.videoMorphCount += n;
    if (row.type === "photo_animate") stats.photoAnimateCount += n;
  }

  res.json(stats);
});

router.get("/jobs/recent", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;

  const jobs = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.userId, userId))
    .orderBy(desc(jobsTable.createdAt))
    .limit(5);

  res.json(jobs);
});

router.get("/jobs", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, type, limit = 20, offset = 0 } = parsed.data;

  const conditions = [eq(jobsTable.userId, userId)];
  if (status) conditions.push(eq(jobsTable.status, status as any));
  if (type) conditions.push(eq(jobsTable.type, type as any));

  const [jobs, totalResult] = await Promise.all([
    db
      .select()
      .from(jobsTable)
      .where(and(...conditions))
      .orderBy(desc(jobsTable.createdAt))
      .limit(limit ?? 20)
      .offset(offset ?? 0),
    db
      .select({ cnt: count() })
      .from(jobsTable)
      .where(and(...conditions)),
  ]);

  res.json({ jobs, total: Number(totalResult[0]?.cnt ?? 0) });
});

router.post("/jobs", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, inputObjectPath, title, style } = parsed.data;

  const [job] = await db
    .insert(jobsTable)
    .values({
      userId,
      type,
      inputObjectPath,
      title: title ?? null,
      style: style ?? "anime",
      status: "queued",
      progress: 0,
    })
    .returning();

  res.status(201).json(job);
});

router.get("/jobs/:id", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const parsed = GetJobParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = parsed.data.id;
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, id), eq(jobsTable.userId, userId)));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(job);
});

router.delete("/jobs/:id", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const parsed = DeleteJobParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = parsed.data.id;
  const [job] = await db
    .delete(jobsTable)
    .where(and(eq(jobsTable.id, id), eq(jobsTable.userId, userId)))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/jobs/:id/retry", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const parsed = RetryJobParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = parsed.data.id;
  const [existing] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, id), eq(jobsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (existing.status !== "failed") {
    res.status(400).json({ error: "Only failed jobs can be retried" });
    return;
  }

  const [updated] = await db
    .update(jobsTable)
    .set({
      status: "queued",
      progress: 0,
      errorMessage: null,
      outputObjectPath: null,
      workerId: null,
      startedAt: null,
    })
    .where(eq(jobsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
