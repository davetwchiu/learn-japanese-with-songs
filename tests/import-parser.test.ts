import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseImportedLesson } from "../app/import-parser";

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

test("removes the unneeded eight-angles block from the site", async () => {
  const source = await readFile(
    new URL("../app/site-client.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /ONE SONG, EIGHT ANGLES|八個學習入口/);
});
