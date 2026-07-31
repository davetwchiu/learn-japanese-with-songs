import { env } from "cloudflare:workers";
import { isSong, type Song } from "@/app/song-data";

const createSongsTable = `
  CREATE TABLE IF NOT EXISTS songs (
    slug TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

function getD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("歌曲資料庫暫時未能使用。");
  return db;
}

async function readyDb(): Promise<D1Database> {
  const db = getD1();
  await db.prepare(createSongsTable).run();
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

export async function saveStoredSong(song: Song): Promise<void> {
  const db = await readyDb();
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO songs (slug, data, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(song.slug, JSON.stringify(song), now, now)
    .run();
}
