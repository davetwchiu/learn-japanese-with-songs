import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  lessonMarkdown,
  parseImportedLesson,
  parseYoutubeId,
} from "../app/import-parser";
import {
  compareSongsByGojūon,
  loadSongLibrary,
  normalizeRubyAnnotations,
  normalizeSong,
  plainSongTitle,
  type Song,
  vocabularySortKey,
} from "../app/song-data";

test("normalizes parenthesized vocabulary readings to canonical ruby markup", () => {
  assert.equal(
    normalizeRubyAnnotations(
      "例：意味（いみ）を勘違（かんちが）いしていた。",
    ),
    "例：[意味]{いみ}を[勘違]{かんちが}いしていた。",
  );

  const song = normalizeSong({
    slug: "lucky-color",
    title: "ラッキーカラー",
    vocabulary: [
      {
        id: "misunderstanding",
        term: "勘違い",
        reading: "かんちがい",
        partOfSpeech: "名詞、する動詞",
        meaning: "誤會、誤解",
        note: "",
        exampleJp: "「勘違いする」是弄錯、誤以為。",
        exampleZh: "例：意味（いみ）を勘違（かんちが）いしていた。",
      },
    ],
  });

  assert.equal(
    song.vocabulary[0].exampleZh,
    "例：[意味]{いみ}を[勘違]{かんちが}いしていた。",
  );
});

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

test("reads the song title reading from the final lesson line", () => {
  const song = parseImportedLesson(`# 《桜が降る夜は》日文歌詞學習材料

## 二、逐句日中對照翻譯

**桜が降る夜は**
在櫻花飄落的夜晚。

歌名讀音：さくらがふるよるは`);
  assert.equal(song.titleReading, "さくらがふるよるは");
});

test("keeps a final song title reading out of displayed lesson text", () => {
  const song = parseImportedLesson(`自訂課文

今日はいい天気です。

歌名讀音：じていかぶん`);
  assert.equal(song.titleReading, "じていかぶん");
  assert.equal(song.rawText, "自訂課文\n\n今日はいい天気です。");
  assert.doesNotMatch(song.rawText ?? "", /歌名讀音/);
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

test("creates editable markdown for lessons saved before source markdown", () => {
  const markdown = lessonMarkdown({
    slug: "old-lesson",
    title: "昔の課文",
    titleReading: "むかしのかぶん",
    artist: "テスト歌手",
    level: "N4",
    publishedAt: "2026-08-04",
    youtubeId: null,
    tags: ["日常"],
    summary: "舊資料也可修改。",
    lyrics: [{ jp: "昔を思い出す", zh: "想起往昔。" }],
    context: ["一段測試背景。"],
    grammar: [],
    vocabulary: [],
    spoken: [],
    pitfalls: [],
    phrases: [],
  });
  const reparsed = parseImportedLesson(markdown);
  assert.match(markdown, /## 一、逐句日中對照翻譯/);
  assert.equal(reparsed.title, "昔の課文");
  assert.equal(reparsed.lyrics[0].zh, "想起往昔。");
  assert.equal(reparsed.titleReading, "むかしのかぶん");
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

test("combines per-kanji readings and accepts two-column vocabulary tables", () => {
  const song = parseImportedLesson(`# 《貴方解剖純愛歌 ～死ね～》日文歌詞學習材料

## 二、逐句日中對照翻譯

**あなたの両腕を切り落として　私の腰に巻き付ければ**
把你的雙臂斬下來，纏在我的腰上。

**どうして私から逃げ出すの**
為什麼你要從我身邊逃走？

**あなたが他の人と手を繋いでるのを見たら**
如果我看到你和別人牽手。

**足を引き裂き　歩かせやしない**
撕裂你的雙腿，讓你無法行走。

## 五、生字

| 單字 | 意思 |
| --- | --- |
| 両腕（りょううで） | 雙臂 |
| 切（き）り落（お）とす | 斬下 |
| 巻（ま）き付（つ）ける | 纏上 |
| 逃（に）げ出（だ）す | 逃走 |
| 手（て）を繋（つな）ぐ | 牽手 |
| 引（ひ）き裂（さ）く | 撕裂 |`);

  assert.deepEqual(
    song.vocabulary.map(({ term, reading, meaning }) => ({
      term,
      reading,
      meaning,
    })),
    [
      { term: "両腕", reading: "りょううで", meaning: "雙臂" },
      { term: "切り落とす", reading: "きりおとす", meaning: "斬下" },
      { term: "巻き付ける", reading: "まきつける", meaning: "纏上" },
      { term: "逃げ出す", reading: "にげだす", meaning: "逃走" },
      { term: "手を繋ぐ", reading: "てをつなぐ", meaning: "牽手" },
      { term: "引き裂く", reading: "ひきさく", meaning: "撕裂" },
    ],
  );
  assert.equal(
    song.lyrics[0].jp,
    "あなたの[両腕]{りょううで}を[切]{き}り[落]{お}として　私の腰に[巻]{ま}き[付]{つ}ければ",
  );
  assert.equal(song.lyrics[1].jp, "どうして私から[逃]{に}げ[出]{だ}すの");
  assert.equal(
    song.lyrics[2].jp,
    "あなたが他の人と[手]{て}を[繋]{つな}いでるのを見たら",
  );
  assert.equal(song.lyrics[3].jp, "足を[引]{ひ}き[裂]{さ}き　歩かせやしない");
});

test("adds missing ruby without replacing existing explicit ruby", () => {
  const song = parseImportedLesson(
    JSON.stringify({
      slug: "partial-ruby",
      title: "部分注音",
      lyrics: [
        {
          jp: "あなたの[両腕]{りょううで}を切り落として",
          zh: "把你的雙臂斬下來。",
        },
      ],
      grammar: [],
      vocabulary: [
        {
          id: "arms",
          term: "両腕",
          reading: "りょううで",
          partOfSpeech: "名詞",
          meaning: "雙臂",
          note: "",
          exampleJp: "",
          exampleZh: "",
        },
        {
          id: "cut-off",
          term: "切り落とす",
          reading: "きりおとす",
          partOfSpeech: "動詞",
          meaning: "斬下",
          note: "",
          exampleJp: "",
          exampleZh: "",
        },
      ],
    }),
  );

  assert.equal(
    song.lyrics[0].jp,
    "あなたの[両腕]{りょううで}を[切]{き}り[落]{お}として",
  );
});

test("aligns readings when okurigana also appears inside a kanji reading", () => {
  const song = parseImportedLesson(
    JSON.stringify({
      slug: "ambiguous-okurigana",
      title: "送り仮名",
      lyrics: [
        { jp: "寒さを言い聞かせる", zh: "" },
        { jp: "胸が痛い", zh: "" },
      ],
      grammar: [],
      vocabulary: [
        {
          id: "cold",
          term: "寒さ",
          reading: "さむさ",
          partOfSpeech: "名詞",
          meaning: "寒冷",
          note: "",
          exampleJp: "",
          exampleZh: "",
        },
        {
          id: "tell",
          term: "言い聞かせる",
          reading: "いいきかせる",
          partOfSpeech: "動詞",
          meaning: "說服",
          note: "",
          exampleJp: "",
          exampleZh: "",
        },
        {
          id: "heartache",
          term: "胸が痛い",
          reading: "むねがいたい",
          partOfSpeech: "表達",
          meaning: "心痛",
          note: "",
          exampleJp: "",
          exampleZh: "",
        },
      ],
    }),
  );

  assert.equal(
    song.lyrics[0].jp,
    "[寒]{さむ}さを[言]{い}い[聞]{き}かせる",
  );
  assert.equal(song.lyrics[1].jp, "[胸]{むね}が[痛]{いた}い");
});

test("keeps complete everyday alternatives in practical phrases", () => {
  const song = parseImportedLesson(`# 《君の夢を聞きながら、僕は笑えるアイデアを！》

## 八、值得背下來的實用句子

### 6. 表示數也數不完

数えきれない　もしもの話して

中文：來談談數也數不完的「如果……」吧。
情境：原句省略助詞，較適合歌詞或親密口語。日常較完整的說法是：

数（かぞ）えきれないほど、いろいろな「もしも」の話（はなし）をしよう。
來談談多得數不完的各種「如果……」吧。

### 7. 鼓勵別人投入新事物

何でも飛び込め

中文：無論是甚麼，都放膽跳進去吧。
情境：適合比賽、冒險故事或非常熟悉的伙伴之間。命令形較強，不宜直接對陌生人或上司使用。一般鼓勵可說：

何（なん）でも思（おも）い切（き）って挑戦（ちょうせん）してみて。
甚麼都放膽試着挑戰吧。`);

  assert.deepEqual(song.phrases, [
    {
      jp: "数えきれない　もしもの話して",
      zh: "來談談數也數不完的「如果……」吧。",
      when:
        "原句省略助詞，較適合歌詞或親密口語。日常較完整的說法是：\n\n数（かぞ）えきれないほど、いろいろな「もしも」の話（はなし）をしよう。\n來談談多得數不完的各種「如果……」吧。",
    },
    {
      jp: "何でも飛び込め",
      zh: "無論是甚麼，都放膽跳進去吧。",
      when:
        "適合比賽、冒險故事或非常熟悉的伙伴之間。命令形較強，不宜直接對陌生人或上司使用。一般鼓勵可說：\n\n何（なん）でも思（おも）い切（き）って挑戦（ちょうせん）してみて。\n甚麼都放膽試着挑戰吧。",
    },
  ]);
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

test("sorts songs by Japanese title reading", () => {
  const songs = [
    "裸の心",
    "葵",
    "双葉（ふたば）",
    "会いに行くのに",
    "愛を知るまでは",
  ]
    .map((title) => normalizeSong({ slug: "song", title, lyrics: [] }))
    .sort(compareSongsByGojūon);
  assert.deepEqual(
    songs.map((song) => song.title),
    [
      "会いに行くのに",
      "愛を知るまでは",
      "葵",
      "裸の心",
      "双葉（ふたば）",
    ],
  );
});

test("shows plain song titles without ruby annotations", () => {
  assert.equal(
    plainSongTitle("[桜]{さくら}が[降]{ふ}る[夜]{よる}は"),
    "桜が降る夜は",
  );
  assert.equal(plainSongTitle("双葉（ふたば）"), "双葉");
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

test("renders ruby annotations from every vocabulary text field", async () => {
  const source = await readFile(
    new URL("../app/site-client.tsx", import.meta.url),
    "utf8",
  );
  for (const field of [
    "word.partOfSpeech",
    "word.meaning",
    "word.note",
    "word.exampleJp",
    "word.exampleZh",
  ]) {
    assert.match(
      source,
      new RegExp(`<RubyText>\\{${field.replace(".", "\\.")}\\}</RubyText>`),
    );
  }
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
  assert.match(worker, /\$\{CACHE_PREFIX\}v4/);
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
  assert.match(client, /\/quiz/);
  assert.match(client, /X-Uta-Refresh/);
  assert.match(client, /optionalUrls:\s*loadedAssets/);
  assert.match(client, /isAppleMobileDevice/);
  assert.match(client, /registration\.unregister/);
  assert.match(client, /更新離線學習內容/);
  assert.match(client, /\/aimyon-poster-background\.webp/);
  assert.match(worker, /\/aimyon-poster-background\.webp/);
  assert.match(worker, /\/quiz/);
  assert.match(login, /resetOfflineShell/);
  assert.match(login, /Promise\.race/);
  assert.match(login, /OFFLINE_RESET_WAIT_MS/);
  assert.match(login, /action="\/api\/auth\/login"/);
  assert.match(login, /method="post"/);
  assert.match(login, /name="password"/);
  assert.match(login, /window\.location\.replace/);
  assert.doesNotMatch(client, /logout|登出/);
  assert.doesNotMatch(worker, /CLEAR_CACHE/);
  assert.match(
    await readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    /@supports \(-webkit-touch-callout: none\)/,
  );
  assert.match(layout, /site\.webmanifest/);
  assert.equal(JSON.parse(manifest).display, "standalone");
});

test("keeps login usable without hydration and removes logout", async () => {
  const [client, login, authRoute, passwordAuth] = await Promise.all([
    readFile(new URL("../app/site-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login-client.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/auth/[action]/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/password-auth.ts", import.meta.url), "utf8"),
  ]);
  assert.match(login, /action="\/api\/auth\/login"/);
  assert.match(login, /method="post"/);
  assert.match(login, /name="password"/);
  assert.match(login, /LOGIN_TIMEOUT_MS/);
  assert.match(login, /OFFLINE_RESET_WAIT_MS/);
  assert.match(authRoute, /request\.formData\(\)/);
  assert.match(authRoute, /status:\s*303/);
  assert.match(authRoute, /"Set-Cookie": cookie/);
  assert.doesNotMatch(client, /logout|登出/);
  assert.doesNotMatch(authRoute, /action === "logout"/);
  assert.doesNotMatch(passwordAuth, /clearSessionCookieHeader/);
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

test("adds fixed accessible controls for lessons with a ready YouTube player", async () => {
  const [client, player, styles] = await Promise.all([
    readFile(new URL("../app/site-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/youtube-player.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /song\.youtubeId \? " song-page-with-player-controls"/);
  assert.match(client, /song\.youtubeId \? \([\s\S]*?<YouTubePlayer/);
  assert.match(player, /pauseVideo\(\): void/);
  assert.match(player, /playerRef\.current\?\.pauseVideo\(\)/);
  assert.match(player, /seekTo\(Math\.max\(0, currentTime \+ seconds\), true\)/);
  assert.match(player, /useImperativeHandle/);
  assert.match(player, /aria-label="影片播放控制"/);
  for (const label of ["倒退 5 秒", "播放影片", "暫停影片", "快進 5 秒"]) {
    assert.match(player, new RegExp(`aria-label="${label}"`));
  }
  assert.equal((player.match(/disabled=\{disabled\}/g) ?? []).length, 4);
  assert.match(player, /onPlaybackStateChange\?\.\("playing"\)/);
  assert.match(player, /onPlaybackStateChange\?\.\("paused"\)/);
  assert.match(player, /aria-pressed=\{playbackState === "playing"\}/);
  assert.match(player, /aria-pressed=\{playbackState === "paused"\}/);
  assert.match(client, /playbackState=\{playerPlaybackState\}/);
  assert.match(styles, /\.fixed-player-controls\s*\{[\s\S]*?position:\s*fixed;/);
  assert.match(styles, /\.song-page-with-player-controls\s*\{[\s\S]*?padding-bottom:/);
  assert.match(styles, /\.fixed-player-controls\s*\{[\s\S]*?safe-area-inset-bottom/);
  assert.match(
    styles,
    /@media \(max-width: 980px\)\s*\{[\s\S]*?\.lesson-layout\s*\{[\s\S]*?display:\s*block;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 980px\)\s*\{[\s\S]*?\.lesson-toc\s*\{[\s\S]*?position:\s*-webkit-sticky;[\s\S]*?position:\s*sticky;/,
  );
  assert.match(
    styles,
    /\.fixed-player-controls button\[aria-pressed="true"\]\s*\{[\s\S]*?background:\s*var\(--red\)/,
  );
});
