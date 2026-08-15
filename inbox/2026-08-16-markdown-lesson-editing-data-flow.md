# 修改課文功能：Markdown 資料流核對

## 結論

現時「修改課文」功能有兩種來源，但優先次序很清楚：

1. **新匯入或已經用修改功能儲存過的課文**：直接顯示已保存的原始 Markdown（`sourceMarkdown`）。
2. **舊課文沒有 `sourceMarkdown`**：網站才會由已解析的結構化 `Song` 資料重新產生一份標準 Markdown。

因此，現有舊課文第一次開啟「修改課文」時，多數看到的是網站由結構化資料重組的 Markdown；新匯入課文，以及修改並儲存過一次的課文，之後則會直接讀取保存的 Markdown。

## 實際資料流

管理頁 `app/songs/[slug]/manage/manage-client.tsx` 載入：

```ts
GET /api/songs/:slug
→ 取得結構化 Song JSON
→ lessonMarkdown(song)
→ 有 sourceMarkdown：直接回傳 sourceMarkdown
→ 沒有 sourceMarkdown：由 Song 欄位重組標準 Markdown
```

管理頁實際使用：

```ts
setMarkdown(lessonMarkdown(result.song));
```

`app/import-parser.ts` 的 `lessonMarkdown()` 首先判斷：

```ts
export function lessonMarkdown(song: Song): string {
  if (song.sourceMarkdown) return song.sourceMarkdown;
```

所以只要 `sourceMarkdown` 存在，網站不會 reverse engineer Markdown。

## 新匯入課文

`app/api/import/route.ts` 在匯入時先用 `parseImportedLesson()` 把 Markdown 解析成結構化 `Song`，但同時保存原輸入內容：

```ts
const song = {
  ...importedSong,
  sourceMarkdown: content.trim(),
  ...(videoId ? { youtubeId: videoId } : {}),
};
```

換言之，新課文在 D1 內同時有：

- parser 產生的結構化課文資料；以及
- 原始 Markdown `sourceMarkdown`。

修改頁顯示時會優先使用後者。除了 `trim()` 移除開頭及結尾空白，原 Markdown 內容會保留。

## 舊課文 fallback

如果課文是在加入 `sourceMarkdown` 功能之前已存在，`lessonMarkdown(song)` 找不到 `sourceMarkdown`，便會用以下結構化欄位重組 Markdown：

- `title`
- `artist`
- `level`
- `tags`
- `summary`
- `lyrics`
- `context`
- `grammar`
- `vocabulary`
- `spoken`
- `pitfalls`
- `phrases`
- `titleReading`

這可以視為 reverse engineering，但更準確是 serializer／標準格式輸出。它只能重建課文內容，不能保證還原當初匯入 Markdown 的原有排版、標題寫法、空行、分隔線或其他格式細節。

## 儲存修改後

`app/api/songs/[slug]/route.ts` 收到修改後的 Markdown 時會：

1. `parseImportedLesson(markdown)` 重新解析內容；
2. 保留原有 `slug`；
3. 保留原有 `publishedAt`；
4. 保留現有 YouTube 設定；
5. 把修改後 Markdown 寫入 `sourceMarkdown`；
6. 儲存更新後的結構化 `Song`；
7. 按既有流程產生 mirror update。

核心程式：

```ts
const parsed = parseImportedLesson(markdown);
updated = {
  ...parsed,
  slug: song.slug,
  publishedAt: song.publishedAt,
  youtubeId: updated.youtubeId,
  sourceMarkdown: markdown,
};
```

所以一篇舊課文即使第一次進入修改頁時是由結構化資料生成 Markdown，只要儲存一次，之後再開修改頁便會直接顯示該次實際儲存的 Markdown，不再重新生成。

## 相關檔案

- `app/songs/[slug]/manage/manage-client.tsx` — 修改課文 UI，載入後呼叫 `lessonMarkdown()`。
- `app/import-parser.ts` — `lessonMarkdown()`；有 `sourceMarkdown` 時直接回傳，否則 serialize 結構化課文。
- `app/api/import/route.ts` — 新匯入課文時保存 `sourceMarkdown: content.trim()`。
- `app/api/songs/[slug]/route.ts` — 修改儲存時重新 parse Markdown，並把修改版本保存為 `sourceMarkdown`。
- `app/song-data.ts` — `Song` type 包含 optional `sourceMarkdown?: string`。
