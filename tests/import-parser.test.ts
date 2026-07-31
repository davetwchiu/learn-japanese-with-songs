import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseImportedLesson,
  parseYoutubeId,
} from "../app/import-parser";
import {
  loadSongLibrary,
  type Song,
  vocabularySortKey,
} from "../app/song-data";

const pasted = `# 《春の道》日文歌詞學習材料

歌：テスト歌手

## 一、逐句日中對照翻譯

**春の道を歩く**
走在春天的路上。

## 二、歌曲內容和情境

這是一首關於春天的短歌。

## 三、文法重點

### 1. ～を歩く

歌詞：

**春の道を歩く**

結構：

> 名詞＋を＋歩く

表示在某處步行。

例句：

**公園を歩く。**
在公園散步。

## 四、生字及假名讀音

| 生字 | 詞性／中文意思 | 用法或例句 |
| --- | --- | --- |
| 春（はる） | 名詞；春天 | 春（はる）が来（く）る。 |

## 五、擬聲詞、擬態詞及口語

### 1. ぽかぽか

溫暖的感覺。

日常會話常用。

## 六、容易誤解的地方

### 1. 春の道

指春天景色中的道路。

## 七、值得背下來的實用句子

### 1. 公園を歩く。

**公園を歩く。**

中文：在公園散步。
情境：談論散步。`;

test("extracts every learning section from a normal pasted lesson", () => {
  const song = parseImportedLesson(pasted);
  assert.equal(song.title, "春の道");
  assert.equal(song.artist, "テスト歌手");
  assert.equal(song.lyrics.length, 1);
  assert.equal(song.grammar.length, 1);
  assert.equal(song.grammar[0].source, "春の道を歩く");
  assert.match(song.grammar[0].explanation, /表示在某處步行/);
  assert.equal(song.vocabulary.length, 1);
  assert.equal(song.spoken.length, 1);
  assert.equal(song.pitfalls.length, 1);
  assert.equal(song.phrases.length, 1);
  assert.equal(song.rawText, undefined);
});

test("accepts different heading levels, bold metadata, and list examples", () => {
  const flexible = `前言可以放在歌曲資料之前。

# 一、歌曲資料

歌名：**猫の歌**
歌手：テスト歌手

# 二、歌詞翻譯

## 第一段

**猫が好き**
我喜歡貓。

**猫の手は痛い**
貓掌令人覺得痛。

這兩句一起描寫主角又喜歡貓、又拿牠沒辦法的矛盾心情。

# 三、背景與情境

這是一首關於貓的歌。

# 四、文法解析

## 1. ～が好き：喜歡……

**猫が好き**

意思：表示喜歡某樣東西。

例句：

* **音楽（おんがく）が好（す）きです。**
  我喜歡音樂。

# 五、詞彙與讀音

| 詞彙 | 詞性／中文意思 | 用法或例句 |
| --- | --- | --- |
| 猫（ねこ） | 名詞；貓 | 猫（ねこ）が好（す）きです。我喜歡貓。 |

# 六、口語表達

## 1. 好き

表示喜歡。

# 七、常見錯誤

## 1. 猫が好き

「が」標示喜歡的對象。

# 八、實用句子

## 1. 猫が好きです。

中文：我喜歡貓。
適用情境：談論喜好。`;
  const song = parseImportedLesson(flexible);
  assert.equal(song.title, "猫の歌");
  assert.equal(song.lyrics.length, 2);
  assert.equal(song.lyrics[0].jp, "[猫]{ねこ}が好き");
  assert.match(song.lyrics[1].note ?? "", /這兩句一起描寫/);
  assert.equal(song.grammar[0].pattern, "～が好き");
  assert.equal(song.grammar[0].meaning, "喜歡……");
  assert.equal(song.grammar[0].source, "猫が好き");
  assert.equal(song.grammar[0].examples.length, 1);
  assert.equal(song.vocabulary.length, 1);
  assert.equal(song.spoken.length, 1);
  assert.equal(song.pitfalls.length, 1);
  assert.equal(song.phrases[0].when, "談論喜好。");
});

test("preserves a plain unstructured text block", () => {
  const song = parseImportedLesson("我的日文課文\n\n今日はいい天気です。");
  assert.equal(song.title, "我的日文課文");
  assert.match(song.rawText ?? "", /今日はいい天気です/);
});

test("accepts complete JSON lessons", () => {
  const song = parseImportedLesson(
    JSON.stringify({
      slug: "json-lesson",
      title: "JSON 課文",
      lyrics: [{ jp: "春です。", zh: "是春天。" }],
      grammar: [],
      vocabulary: [],
    }),
  );
  assert.equal(song.slug, "json-lesson");
  assert.equal(song.lyrics[0].zh, "是春天。");
});

test("accepts common YouTube URL formats only", () => {
  assert.equal(
    parseYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(
    parseYoutubeId("https://youtu.be/dQw4w9WgXcQ?t=12"),
    "dQw4w9WgXcQ",
  );
  assert.equal(parseYoutubeId("https://example.com/?v=dQw4w9WgXcQ"), null);
});

test("adds ruby to common inflected vocabulary in imported lyrics", () => {
  const song = parseImportedLesson(`# 《活用の歌》日文歌詞學習材料

## 二、逐句日中對照翻譯

**彼女を求めて、気に入らない**
尋找她，卻不合心意。

## 五、生字及假名讀音

| 生字 | 詞性／中文意思 | 用法或例句 |
| --- | --- | --- |
| 求める（もとめる） | 動詞；尋求 | 答えを求める。 |
| 気に入る（きにいる） | 慣用語；喜歡 | この歌が気に入る。 |`);
  assert.equal(
    song.lyrics[0].jp,
    "彼女を[求]{もと}めて、[気]{き}に[入]{い}らない",
  );
});

test("sorts kana-only and kanji vocabulary together by reading", () => {
  const words = [
    { term: "猫", reading: "ねこ" },
    { term: "おてて", reading: "" },
    { term: "愛", reading: "あい" },
  ].sort((left, right) =>
    vocabularySortKey(left).localeCompare(vocabularySortKey(right), "ja"),
  );
  assert.deepEqual(
    words.map((word) => word.term),
    ["愛", "おてて", "猫"],
  );
});

test("keeps stored lessons when GitHub is temporarily unavailable", async () => {
  const storedSong: Song = {
    slug: "saved-lesson",
    title: "已儲存課文",
    titleReading: "",
    artist: "テスト歌手",
    level: "未分類",
    publishedAt: "2026-07-31",
    youtubeId: null,
    tags: [],
    summary: "",
    lyrics: [{ jp: "歌です。", zh: "這是一首歌。" }],
    context: [],
    grammar: [],
    vocabulary: [],
    spoken: [],
    pitfalls: [],
    phrases: [],
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.github.com/")) {
      throw new Error("GitHub temporarily unavailable");
    }
    if (url === "/api/songs") {
      return Response.json({ songs: [storedSong] });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const songs = await loadSongLibrary();
    assert.deepEqual(
      songs.map((song) => song.slug),
      ["saved-lesson"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("removes the unneeded eight-angles block from the site", async () => {
  const source = await readFile(
    new URL("../app/site-client.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /ONE SONG, EIGHT ANGLES|八個學習入口/);
});

test("includes offline learning support and a manual update control", async () => {
  const [worker, client, login, layout, manifest] = await Promise.all([
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/site-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8"),
  ]);
  assert.match(worker, /CACHE_URLS/);
  assert.match(worker, /\$\{CACHE_PREFIX\}v2/);
  assert.match(worker, /networkFirstNavigation/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(
    worker,
    /event\.respondWith\(networkFirstNavigation\(request\)\)/,
  );
  assert.match(worker, /event\.respondWith\(cacheFirst\(request\)\)/);
  assert.match(worker, /Promise\.all/);
  assert.match(worker, /ignoreVary:\s*true/);
  assert.doesNotMatch(worker, /cache\.match\("\/"\)/);
  assert.match(client, /serviceWorker[\s\S]+?\.register\("\/sw\.js"/);
  assert.match(client, /\/api\/songs/);
  assert.match(client, /X-Uta-Refresh/);
  assert.match(client, /optionalUrls:\s*loadedAssets/);
  assert.match(client, /isAppleMobileDevice/);
  assert.match(client, /registration\.unregister/);
  assert.match(client, /更新離線學習內容/);
  assert.match(login, /clearCachedLoginDocuments/);
  assert.match(login, /cache\.delete/);
  assert.match(login, /window\.location\.reload/);
  assert.match(
    await readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    /@supports \(-webkit-touch-callout: none\)/,
  );
  assert.match(layout, /site\.webmanifest/);
  assert.equal(JSON.parse(manifest).display, "standalone");
});

test("resumes YouTube playback after returning from another app", async () => {
  const [client, player, styles] = await Promise.all([
    readFile(new URL("../app/site-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/youtube-player.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /<YouTubePlayer/);
  assert.match(player, /enablejsapi/);
  assert.match(player, /visibilitychange/);
  assert.match(player, /addEventListener\("focus", onPageShow\)/);
  assert.match(player, /addEventListener\("blur", rememberPlayback\)/);
  assert.match(player, /pagehide/);
  assert.match(player, /sessionStorage/);
  assert.match(player, /playVideo\(\)/);
  assert.match(player, /onAutoplayBlocked/);
  assert.match(player, /currentPlayerState\(\) !== PLAYER_PLAYING/);
  assert.match(player, /typeof player\.getPlayerState !== "function"/);
  assert.doesNotMatch(
    player,
    /state !== PLAYER_PLAYING && state !== PLAYER_BUFFERING/,
  );
  assert.match(
    player,
    /resumeIntent\.current \|\| resumeAttempt\.current/,
  );
  assert.match(
    player,
    /event\.data === PLAYER_PLAYING[\s\S]*?resumeIntent\.current \|\| resumeAttempt\.current[\s\S]*?verifyResumeSoon\(\)/,
  );
  assert.match(
    player,
    /function verifyResumeSoon\(\)[\s\S]*?currentPlayerState\(\) !== PLAYER_PLAYING[\s\S]*?confirmPlaying\(\)/,
  );
  assert.match(
    player,
    /function resumeOnReturn\(\)[\s\S]*?setResumePrompt\(true\)[\s\S]*?tryResume\(\)/,
  );
  assert.match(
    player,
    /function confirmIntentionalPauseSoon\(\)[\s\S]*?4_000[\s\S]*?lastVisiblePlaying\.current = false/,
  );
  assert.match(
    player,
    /event\.data === PLAYER_PAUSED[\s\S]*?confirmIntentionalPauseSoon\(\)/,
  );
  assert.match(player, /className="floating-player-resume"/);
  assert.match(player, /data-visible=\{resumePrompt/);
  assert.match(player, /繼續播放/);
  assert.match(
    styles,
    /\.floating-player-resume\s*\{[\s\S]*?position:\s*fixed;/,
  );
  assert.match(styles, /safe-area-inset-bottom/);
});
