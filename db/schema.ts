import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const songs = sqliteTable("songs", {
  slug: text("slug").primaryKey(),
  data: text("data").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
