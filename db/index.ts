import { env } from "cloudflare:workers";
import { isSong, type Song } from "@/app/song-data";
import { mirrorTableStatements, type MirrorOperation } from "./mirror";

const createSongsTable = `
  CREATE TABLE IF NOT EXISTS songs (
    slug TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

type DatabaseBindings = {
  DB?: D1Database;
  MIRROR_READ_ONLY?: string;
  MIRROR_SECRET?: string;
  MIRROR_TARGET_URL?: string;
};

function bindings(): DatabaseBindings {
  return env as unknown as DatabaseBindings;
}

export function getD1(): D1Database {
  const db = bindings().DB;
  if (!db) throw new Error("歌曲資料庫暫時未能使用。");
  return db;
}

function shouldEnqueueMirror(): boolean {
  const current = bindings();
  const readOnly = ["1", "true", "yes", "on"].includes(
    (current.MIRROR_READ_ONLY ?? "").toLowerCase(),
  );
  return Boolean(
    !readOnly && current.MIRROR_SECRET && current.MIRROR_TARGET_URL,
  );
}

async function readyDb(): Promise<D1Database> {
  const db = getD1();
  await db.batch(
    [createSongsTable, ...mirrorTableStatements].map((statement) =>
      db.prepare(statement),
    ),
  );
  return db;
}

export async function listStoredSongs(): Promise<Song[]> {
  const db = await readyDb();
  const result = await db
    .prepare("SELECT data FROM songs ORDER BY updated_at DESC")
    .all<{ data: string }>();
  return result.results
    .map(({ data }) => {
      try {
        return JSON.parse(data) as unknown;
      } catch {
        return null;
      }
    })
    .filter(isSong);
}

export async function findStoredSong(slug: string): Promise<Song | null> {
  const db = await readyDb();
  const row = await db
    .prepare("SELECT data FROM songs WHERE slug = ?")
    .bind(slug)
    .first<{ data: string }>();
  if (!row) return null;
  try {
    const value: unknown = JSON.parse(row.data);
    return isSong(value) ? value : null;
  } catch {
    return null;
  }
}

function outboxStatement(
  db: D1Database,
  operation: MirrorOperation,
  slug: string,
  payload: string | null,
  sourceUpdatedAt: number,
  id: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO mirror_outbox
       (id, operation, slug, payload, source_updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, operation, slug, payload, sourceUpdatedAt, sourceUpdatedAt);
}

export async function saveStoredSong(song: Song): Promise<string | null> {
  const db = await readyDb();
  const now = Math.floor(Date.now() / 1000);
  const sourceUpdatedAt = Date.now();
  const data = JSON.stringify(song);
  const statements = [
    db.prepare(
      `INSERT INTO songs (slug, data, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
      .bind(song.slug, data, now, now),
  ];
  const eventId = shouldEnqueueMirror() ? crypto.randomUUID() : null;
  if (eventId) {
    statements.push(
      outboxStatement(db, "upsert", song.slug, data, sourceUpdatedAt, eventId),
    );
  }
  await db.batch(statements);
  return eventId;
}

export async function deleteStoredSong(slug: string): Promise<string | null> {
  const db = await readyDb();
  const statements = [
    db.prepare("DELETE FROM songs WHERE slug = ?").bind(slug),
  ];
  const eventId = shouldEnqueueMirror() ? crypto.randomUUID() : null;
  if (eventId) {
    const sourceUpdatedAt = Date.now();
    statements.push(
      outboxStatement(db, "delete", slug, null, sourceUpdatedAt, eventId),
    );
  }
  await db.batch(statements);
  return eventId;
}
