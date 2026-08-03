import { isSong, type Song } from "@/app/song-data";

export type MirrorOperation = "upsert" | "delete";

export type MirrorEvent = {
  id: string;
  operation: MirrorOperation;
  slug: string;
  sourceUpdatedAt: number;
  song?: Song;
};

export const mirrorTableStatements = [
  `CREATE TABLE IF NOT EXISTS songs (
    slug TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mirror_outbox (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    slug TEXT NOT NULL,
    payload TEXT,
    source_updated_at INTEGER NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS mirror_outbox_retry_idx
    ON mirror_outbox (next_attempt_at, created_at)`,
  `CREATE TABLE IF NOT EXISTS mirror_versions (
    slug TEXT PRIMARY KEY,
    source_updated_at INTEGER NOT NULL,
    operation TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mirror_applied_events (
    id TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`,
];

export async function ensureMirrorTables(db: D1Database): Promise<void> {
  await db.batch(mirrorTableStatements.map((statement) => db.prepare(statement)));
}

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  return new Uint8Array(
    value.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? [],
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

export async function mirrorSignature(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  return bytesToHex(await hmac(secret, `${timestamp}.${body}`));
}

export async function verifyMirrorSignature(
  secret: string,
  timestamp: string,
  body: string,
  supplied: string,
): Promise<boolean> {
  const suppliedBytes = hexToBytes(supplied.replace(/^sha256=/i, ""));
  if (!suppliedBytes) return false;
  return equalBytes(await hmac(secret, `${timestamp}.${body}`), suppliedBytes);
}

export async function verifyBearer(
  secret: string,
  authorization: string | null,
): Promise<boolean> {
  const supplied = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const [expectedDigest, suppliedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  return Boolean(secret) && equalBytes(
    new Uint8Array(expectedDigest),
    new Uint8Array(suppliedDigest),
  );
}

export function parseMirrorEvent(value: unknown): MirrorEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<MirrorEvent>;
  if (
    typeof event.id !== "string" ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(event.id) ||
    !["upsert", "delete"].includes(event.operation ?? "") ||
    typeof event.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.slug) ||
    typeof event.sourceUpdatedAt !== "number" ||
    !Number.isSafeInteger(event.sourceUpdatedAt) ||
    event.sourceUpdatedAt <= 0
  ) {
    return null;
  }
  if (event.operation === "upsert") {
    if (!isSong(event.song) || event.song.slug !== event.slug) return null;
  } else if (event.song !== undefined) {
    return null;
  }
  return event as MirrorEvent;
}

type OutboxRow = {
  id: string;
  operation: string;
  slug: string;
  payload: string | null;
  source_updated_at: number;
  attempt_count: number;
};

function rowToEvent(row: OutboxRow): MirrorEvent | null {
  let song: unknown;
  try {
    song = row.payload ? JSON.parse(row.payload) : undefined;
  } catch {
    return null;
  }
  return parseMirrorEvent({
    id: row.id,
    operation: row.operation,
    slug: row.slug,
    sourceUpdatedAt: row.source_updated_at,
    ...(song ? { song } : {}),
  });
}

export async function deliverMirrorOutbox(
  db: D1Database,
  targetUrl: string,
  secret: string,
  limit = 25,
): Promise<{ delivered: number; failed: number; invalid: number }> {
  if (!targetUrl || !secret) return { delivered: 0, failed: 0, invalid: 0 };
  await ensureMirrorTables(db);
  const now = Date.now();
  const rows = await db
    .prepare(
      `SELECT id, operation, slug, payload, source_updated_at, attempt_count
       FROM mirror_outbox
       WHERE next_attempt_at <= ?
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .bind(now, Math.max(1, Math.min(limit, 100)))
    .all<OutboxRow>();

  let delivered = 0;
  let failed = 0;
  let invalid = 0;
  for (const row of rows.results) {
    const event = rowToEvent(row);
    if (!event) {
      invalid += 1;
      await db
        .prepare(
          `UPDATE mirror_outbox
           SET attempt_count = attempt_count + 1,
               next_attempt_at = ?,
               last_error = ?
           WHERE id = ?`,
        )
        .bind(now + 86_400_000, "Invalid mirror event", row.id)
        .run();
      continue;
    }

    const body = JSON.stringify(event);
    const timestamp = String(Math.floor(Date.now() / 1000));
    try {
      const signature = await mirrorSignature(secret, timestamp, body);
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-uta-mirror-event": event.id,
          "x-uta-mirror-timestamp": timestamp,
          "x-uta-mirror-signature": `sha256=${signature}`,
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`Mirror receiver returned ${response.status}`);
      }
      await db.prepare("DELETE FROM mirror_outbox WHERE id = ?").bind(row.id).run();
      delivered += 1;
    } catch (error) {
      failed += 1;
      const attempt = row.attempt_count + 1;
      const delay = Math.min(3_600_000, 15_000 * 2 ** Math.min(attempt - 1, 8));
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Mirror delivery failed";
      await db
        .prepare(
          `UPDATE mirror_outbox
           SET attempt_count = ?, next_attempt_at = ?, last_error = ?
           WHERE id = ?`,
        )
        .bind(attempt, Date.now() + delay, message, row.id)
        .run();
    }
  }
  return { delivered, failed, invalid };
}

export async function applyMirrorEvent(
  db: D1Database,
  event: MirrorEvent,
): Promise<"applied" | "duplicate"> {
  await ensureMirrorTables(db);
  const duplicate = await db
    .prepare("SELECT 1 AS found FROM mirror_applied_events WHERE id = ?")
    .bind(event.id)
    .first<{ found: number }>();
  if (duplicate) return "duplicate";

  const nowSeconds = Math.floor(Date.now() / 1000);
  const versionGuard =
    "NOT EXISTS (SELECT 1 FROM mirror_versions WHERE slug = ? AND source_updated_at >= ?)";
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT OR IGNORE INTO mirror_applied_events (id, applied_at) VALUES (?, ?)`,
      )
      .bind(event.id, nowSeconds),
  ];

  if (event.operation === "upsert" && event.song) {
    statements.push(
      db
        .prepare(
          `INSERT INTO songs (slug, data, created_at, updated_at)
           SELECT ?, ?, ?, ? WHERE ${versionGuard}
           ON CONFLICT(slug) DO UPDATE SET
             data = excluded.data,
             updated_at = excluded.updated_at`,
        )
        .bind(
          event.slug,
          JSON.stringify(event.song),
          nowSeconds,
          nowSeconds,
          event.slug,
          event.sourceUpdatedAt,
        ),
    );
  } else {
    statements.push(
      db
        .prepare(`DELETE FROM songs WHERE slug = ? AND ${versionGuard}`)
        .bind(event.slug, event.slug, event.sourceUpdatedAt),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO mirror_versions (slug, source_updated_at, operation)
         VALUES (?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           source_updated_at = excluded.source_updated_at,
           operation = excluded.operation
         WHERE excluded.source_updated_at > mirror_versions.source_updated_at`,
      )
      .bind(event.slug, event.sourceUpdatedAt, event.operation),
  );
  await db.batch(statements);
  return "applied";
}
