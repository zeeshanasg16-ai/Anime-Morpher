import {
  pgTable,
  text,
  serial,
  integer,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type", { enum: ["video_morph", "photo_animate"] }).notNull(),
  status: text("status", {
    enum: ["queued", "processing", "completed", "failed"],
  })
    .notNull()
    .default("queued"),
  title: text("title"),
  inputObjectPath: text("input_object_path").notNull(),
  outputObjectPath: text("output_object_path"),
  thumbnailObjectPath: text("thumbnail_object_path"),
  progress: integer("progress").notNull().default(0),
  errorMessage: text("error_message"),
  style: text("style", {
    enum: ["anime", "cartoon", "ghibli", "cyberpunk", "watercolor"],
  }).default("anime"),
  durationSeconds: real("duration_seconds"),
  // Job-coordination fields for safe multi-worker claiming + crash recovery.
  workerId: text("worker_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  progress: true,
  status: true,
  outputObjectPath: true,
  thumbnailObjectPath: true,
  errorMessage: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
