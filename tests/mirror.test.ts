import assert from "node:assert/strict";
import test from "node:test";
import {
  mirrorSignature,
  parseMirrorEvent,
  verifyBearer,
  verifyMirrorSignature,
} from "../db/mirror";
import type { Song } from "../app/song-data";

const song: Song = {
  slug: "mirror-test-song",
  title: "鏡像測試",
  titleReading: "きょうぞうてすと",
  artist: "Test",
  level: "N5",
  publishedAt: "2026-08-03",
  youtubeId: null,
  tags: [],
  summary: "Test song",
  lyrics: [{ jp: "歌", zh: "歌" }],
  context: [],
  grammar: [],
  vocabulary: [],
  spoken: [],
  pitfalls: [],
  phrases: [],
};

test("mirror signatures verify the timestamp and exact body", async () => {
  const secret = "a".repeat(64);
  const timestamp = "1785715200";
  const body = JSON.stringify({ hello: "世界" });
  const signature = await mirrorSignature(secret, timestamp, body);

  assert.equal(
    await verifyMirrorSignature(secret, timestamp, body, `sha256=${signature}`),
    true,
  );
  assert.equal(
    await verifyMirrorSignature(secret, timestamp, `${body} `, signature),
    false,
  );
});

test("mirror events require a matching, valid song", () => {
  const event = {
    id: "mirror-event-123",
    operation: "upsert",
    slug: song.slug,
    sourceUpdatedAt: 1_785_715_200_000,
    song,
  };
  assert.deepEqual(parseMirrorEvent(event), event);
  assert.equal(parseMirrorEvent({ ...event, slug: "another-song" }), null);
  assert.equal(
    parseMirrorEvent({ ...event, operation: "delete", song: undefined })?.operation,
    "delete",
  );
});

test("manual retry authorization uses the shared secret", async () => {
  const secret = "b".repeat(64);
  assert.equal(await verifyBearer(secret, `Bearer ${secret}`), true);
  assert.equal(await verifyBearer(secret, "Bearer wrong"), false);
});
