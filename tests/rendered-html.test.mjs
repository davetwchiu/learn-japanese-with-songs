import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Japanese song-learning library and ruby markup", async () => {
  const response = await render("/");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /聽歌學日文/);
  assert.match(html, /歌曲目錄/);
  assert.match(html, /掃描新歌曲/);
  assert.match(html, /<ruby>/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview/);
});

test("renders the song lesson and both linked indexes", async () => {
  const [song, grammar, vocabulary] = await Promise.all([
    render("/songs/ameagari").then((response) => response.text()),
    render("/grammar").then((response) => response.text()),
    render("/vocabulary").then((response) => response.text()),
  ]);
  assert.match(song, /逐句日中對照翻譯/);
  assert.match(song, /文法重點/);
  assert.match(song, /生字及假名讀音/);
  assert.match(grammar, /文法索引/);
  assert.match(vocabulary, /生字索引/);
});

test("keeps every song file minimally valid", async () => {
  const song = JSON.parse(
    await readFile(
      new URL("../content/songs/ameagari.json", import.meta.url),
      "utf8",
    ),
  );
  for (const key of ["slug", "title", "lyrics", "grammar", "vocabulary"]) {
    assert.ok(song[key], `missing ${key}`);
  }
  assert.match(song.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});
