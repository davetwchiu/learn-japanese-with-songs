import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const songs = sqliteTable("songs", {
  slug: text("slug").primaryKey(),
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const mirrorOutbox = sqliteTable(
  "mirror_outbox",
  {
    id: text("id").primaryKey(),
    operation: text("operation").notNull(),
    slug: text("slug").notNull(),
    payload: text("payload"),
    sourceUpdatedAt: integer("source_updated_at").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull().default(0),
    lastError: text("last_error"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("mirror_outbox_retry_idx").on(
      table.nextAttemptAt,
      table.createdAt,
    ),
  ],
);

export const mirrorVersions = sqliteTable("mirror_versions", {
  slug: text("slug").primaryKey(),
  sourceUpdatedAt: integer("source_updated_at").notNull(),
  operation: text("operation").notNull(),
});

export const mirrorAppliedEvents = sqliteTable("mirror_applied_events", {
  id: text("id").primaryKey(),
  appliedAt: integer("applied_at").notNull(),
});
