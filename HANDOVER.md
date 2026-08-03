# 聽歌學日文 — Handover Notes

最後更新：2026-08-03（Asia/Hong_Kong）

## 1. Current snapshot

- GitHub content repository: <https://github.com/davetwchiu/learn-japanese-with-songs>
- Primary full-function site: <https://uta-nihongo-davetchiu.d-chiu.workers.dev>
- OpenAI read-only mirror: <https://uta-nihongo-davetchiu.davechiu.chatgpt.site>
- Git branch: `main`
- Cloudflare deployed source HEAD: `dd2a49a`
- OpenAI Sites project ID: `appgprj_6a6c04056b208191bd5167021ce39a3e`
- Latest deployed Sites version: 29
- Hosted environment revision: 4
- Storage: D1 binding `DB`; no R2 binding
- Access: public Sites URL，另有 app-owned password gate

現時 Git `origin` 是上方 GitHub repository。Cloudflare Worker 和 OpenAI
Sites version 29 都使用 commit `dd2a49a`。Cloudflare 是唯一正常寫入來源；
OpenAI Sites 以 `MIRROR_READ_ONLY=1` 運行，會隱藏匯入／管理入口並拒絕
POST、PATCH、DELETE，但相關程式碼沒有刪除。兩個 D1 仍是獨立 database，
由已簽署的單向同步保持內容一致。

## 2. Important security note

Production `SITE_PASSWORD` 已在 Sites 以 secret 設定。不要把實際密碼寫入 Git、`.env.example`、本文件、console log 或 issue/PR。另一個 instance 如需修改密碼，應透過 Sites environment-variable flow 更新 `SITE_PASSWORD`，然後重新 deploy 一個已儲存的 site version，令新 environment revision 生效。

`MIRROR_SECRET` 是另一組獨立 secret，同時設定於 Cloudflare 主 Worker、
`uta-nihongo-mirror-retry` Worker 和 OpenAI Sites。不要讀取、打印、寫入 Git
或用 `SITE_PASSWORD` 代替。`MIRROR_TARGET_URL` 不是 secret；目前指向
OpenAI Sites 的 `/api/internal/mirror`。

`.env.example` 只保留 placeholder。本機開發可把它複製成 `.dev.vars`，再填至少 12 個字元的開發密碼；`.dev.vars` 不應提交。

## 3. What was implemented

### 3.1 YouTube inline player and iPhone resume handoff

原本課堂頁直接 render 一個普通 YouTube iframe。現已改用 `YouTubePlayer` client component，核心行為如下：

- 使用 YouTube IFrame API，iframe URL 加上 `enablejsapi=1` 和 `playsinline=1`。
- 頁面離開或 App 切換前記錄影片 ID、播放時間和 timestamp。
- Resume state 儲存在每個 tab 的 `sessionStorage`，key 為 `uta-youtube-resume:${videoId}`，有效期 6 小時。
- 監聽 `visibilitychange`、`blur`、`focus`、`pagehide` 和 `pageshow`。
- 返回頁面時先嘗試 `seekTo()` 和 `playVideo()`。
- iOS/YouTube 阻止 autoplay、恢復失敗或播放器重新變成 paused 時，顯示右下角浮動播放鍵。
- 浮動鍵平時透明且不可 focus；顯示時只有細小三角形 play icon，沒有 visible text，但保留 `aria-label="繼續播放"`。
- 浮動鍵使用 fixed positioning、safe-area inset 和 mobile-friendly touch target。
- 恢復後不會因一次短暫的 `PLAYING` event 立即當作成功；播放器必須連續維持播放 1.8 秒，才清除 resume intent。
- iPhone 有時會先發出 `PAUSED`，之後才把頁面標記為 hidden。為免第二次 App switch 過早清除 resume state，visible pause 現有 4 秒 grace period；若期間發生 blur/pagehide/hidden，仍會保存恢復資料。
- `getPlayerState()` 有 runtime guard，處理 bfcache/HMR/YouTube object 暫時沒有完整 API 的情況，避免回頁時拋出 unhandled error。

### 3.2 Login and stale iPhone cache fix

Production password 是 Sites runtime secret，不在 repository 內。

曾遇到 iPhone Safari/private browsing 登入 API 已回傳 authenticated，但畫面仍顯示 login page。根因是舊的 login/navigation HTML 被 service worker cache。修正包括：

- 登入成功後，`app/login-client.tsx` 會清除目前 URL 和 `/` 的舊 offline HTML，再 reload。
- Service worker cache 升級到 `uta-nihongo-offline-v2`。
- Navigation request 改為 network-first；網絡失敗才使用 cached navigation。
- `/api/auth` 和 `/api/import` 不會被 service worker cache。
- `X-Uta-Refresh: 1` 可 bypass cache，支援手動更新 offline material。

### 3.3 PWA and offline learning

- 加入 web app manifest、Apple touch icon 和 512px icon。
- 加入 service worker、核心頁面 cache、離線 fallback 和手動「更新離線學習內容」流程。
- iPhone offline lesson navigation 經過多次修正，避免 cache-first navigation 把舊頁或 login page 長期留住。
- Imported lessons/source 暫時 unavailable 時，已儲存課文仍會保留顯示。

### 3.4 Lesson import and content improvements

- Import parser 支援完整文字、Markdown、JSON、公開 URL 和多種 heading/metadata 格式。
- Imported lyrics 可自動把 vocabulary reading 套用成 ruby，包括常見活用形式。
- 支援精確 ruby syntax：`[漢字]{かんじ}`。
- 保留 lyric notes、支援 lesson management。
- Grammar lesson heading 已統一，並加入 D1 migration `0001_normalize_grammar_titles.sql`。

### 3.5 Japanese gojūon song ordering and title readings

- 歌曲目錄不再按匯入／更新日期排列，改為按歌名讀音的日文 50 音順序。
- `Song.titleReading` 是純排序 metadata，不應在歌曲目錄或課文標題顯示。
- AI 課文格式最後一行現規定為 `歌名讀音：完整平假名讀音`；網站 parser 會自動讀取，不再要求使用者在匯入表單另填假名。
- Markdown AI 課文範本 `聽歌學日文_AI課文格式範本.md` 是網站 repository 以外的使用者文件；本次已同步更新，但日後修改 parser 時亦要另行確認範本保持一致。
- 舊課文沒有 `歌名讀音` 仍可匯入。現有課文以已知讀音 fallback、歌名內嵌 ruby 或原歌名作排序 fallback。
- 排序前會把片假名正規化成平假名，並使用日文 collator。
- `plainSongTitle()` 會移除 `[漢字]{かな}` 及 `漢字（かな）` 類型的讀音標記。歌曲目錄卡片和課文頁 `<h1>` 都只顯示純歌名；歌詞、文法、生字及例句的 ruby 不受影響。
- Production 已核對「スーパーガール」和「スケッチ」課文標題：只顯示純歌名，沒有 ruby 或括號假名。

### 3.6 Cloudflare → OpenAI Sites automatic mirror

- Cloudflare 是完整功能主站；每次匯入、更新影片或刪除課文，都會在同一個
  D1 transaction 內寫入歌曲變更及 `mirror_outbox` 事件。
- 主 Worker 會即時把事件送到 OpenAI Sites。失敗事件不會遺失，而會留在
  outbox。
- 獨立 Worker `uta-nihongo-mirror-retry` 每 5 分鐘重試；亦有受
  `MIRROR_SECRET` 保護的 `POST /run`，供維護時手動清空待送事件。
- Receiver 驗證 HMAC-SHA256、5 分鐘 timestamp、event ID、schema、重播及
  per-song version。舊事件不會覆蓋新內容。
- OpenAI Sites 唯讀模式隱藏 header、首頁、footer、索引及課文內所有匯入／
  管理入口；直接開 `/import` 或 `/songs/:slug/manage` 會返回首頁；mutation
  API 回應 403。程式和 routes 仍保留。
- Receiver 只在 `MIRROR_READ_ONLY=1` 時啟用，避免 OpenAI Sites 恢復主站後
  仍被 Cloudflare 靜默覆蓋。

#### Emergency restore of OpenAI Sites to full function

1. 在 OpenAI Sites environment variables 把 `MIRROR_READ_ONLY` 改為 `0`
   （或移除）。不要移除 `SITE_PASSWORD` 或 D1 binding。
2. 重新 deploy 已儲存的 version 29，令新 environment revision 生效。
3. 確認 `/import` 和課文的「管理課文與影片」連結重新出現；現有相同原始碼
   即恢復匯入、更新和刪除功能，無需改 code。
4. Failover 期間在 OpenAI Sites 的修改不會反向同步。Cloudflare 恢復後，
   必須先人工把差異 reconcile 回 Cloudflare，才可重新設定
   `MIRROR_READ_ONLY=1`；否則 Cloudflare 之後的事件可能覆蓋 failover 修改。

## 4. iPhone/YouTube debugging history

### Iteration 1 — automatic return resume

加入 IFrame API 和 lifecycle listeners，嘗試在返回 web app 時自動播放。iOS autoplay policy 不能保證成功，因此加入 manual fallback。

### Iteration 2 — floating button

把原本 inline text/button 改成右下角固定、只有三角形 icon 的 floating button。Button 只在需要人手恢復時顯示。

### Iteration 3 — button only appeared once

第一次原因：YouTube 在返回後可能短暫報 `PLAYING`，隨即又 `PAUSED`。舊 code 在第一個 `PLAYING` event 便清除 resume intent，所以之後的 pause 被誤當成使用者主動暫停。

Fix：加入 1.8 秒 stable-playback verification；未能維持播放便重新顯示浮動鍵。

### Iteration 4 — still only appeared once on physical iPhone

用 393×852 iPhone viewport、實際 YouTube iframe 和「播放 → 暫停 → 離開頁面 → 返回」event order 重現。發現另一個 race：iPhone/YouTube 會先報 `PAUSED`，Safari 之後才報 blur/pagehide/hidden。舊 code 在兩者之間已把 `lastVisiblePlaying` 和 storage 清除。

Fix：

- visible pause 加 4 秒 grace period；
- blur 亦預先保存播放狀態；
- hidden/pagehide 會取消 pending pause confirmation 並保存 resume state；
- 播放恢復穩定後才清除 state；
- 加入 safe player-state reader。

測試期間另發現 `playerRef.current?.getPlayerState is not a function`；這是播放器/bfcache 返回時的 transient object shape，已用 runtime method guard 處理。

Final local browser result：在 393×852 iPhone mode、實際 YouTube player 下，連續三個完整 return/resume cycle 都重新顯示 floating button，而且沒有再出現 script error。

注意：以上是 iPhone-sized in-app browser 測試，不是實體 iPhone Safari automation。實體 iPhone 測試仍以 owner 回報為最終準則。

## 5. Files changed and why

| File | Main responsibility / changes |
| --- | --- |
| `app/youtube-player.tsx` | 新增 YouTube IFrame API wrapper、lifecycle state、resume storage、auto-resume、stable verification、4-second pause grace、floating-button state 和 runtime guards。 |
| `app/site-client.tsx` | 課堂頁改用 `YouTubePlayer`；包含 offline registration、lesson asset caching、manual refresh flow；目錄和課文標題只用 `plainSongTitle()` 顯示純歌名。 |
| `app/globals.css` | Player layout、fixed floating resume button、triangle icon、safe-area/mobile styles，以及 offline UI styles。 |
| `app/login-client.tsx` | 登入成功後清除 cached login/navigation documents，然後 reload。 |
| `public/sw.js` | Offline cache、network-first navigation、cache version bump、API exclusions、refresh bypass 和 fallback page。 |
| `tests/import-parser.test.ts` | Parser、歌名讀音、50 音排序、純歌名、offline、PWA、login-cache 和 YouTube-resume assertions；目前共 18 tests。 |
| `app/import-parser.ts` | Flexible lesson parsing、自動 ruby、inflection handling；讀取課文最後的 `歌名讀音：`。 |
| `app/import/import-client.tsx` | Import UI 配合 parser/ruby 行為；不再要求使用者另填歌名假名。 |
| `app/song-data.ts` | Source failure fallback、grammar-title normalization、50 音排序、片假名正規化、現有讀音 fallback 和 `plainSongTitle()`。 |
| `聽歌學日文_AI課文格式範本.md`（repo 外） | 規定 AI 在整份課文最後一行輸出 `歌名讀音：完整平假名讀音`；網站不直接部署此檔案。 |
| `app/layout.tsx` | PWA manifest、icons 和相關 metadata。 |
| `public/site.webmanifest` | Standalone PWA metadata。 |
| `public/apple-touch-icon.png` | iPhone home-screen icon。 |
| `public/icon-512.png` | PWA 512px icon。 |
| `drizzle/0001_normalize_grammar_titles.sql` | D1 grammar-title data migration。 |
| `drizzle/meta/0001_snapshot.json` | Migration snapshot。 |
| `drizzle/meta/_journal.json` | Migration journal update。 |
| `.openai/hosting.json` | Sites project ID、D1 logical binding、no R2。 |
| `wrangler.jsonc` | Cloudflare Worker、assets、APAC D1、compatibility flags 和 observability 設定。 |
| `wrangler.mirror.jsonc` | 每 5 分鐘運行的 mirror retry Worker、共享 D1 和 receiver URL。 |
| `worker-configuration.d.ts` | Wrangler 依目前 compatibility date／bindings 產生的 Cloudflare runtime types。 |
| `worker/mirror-retry.ts` | 自動及受保護的手動 outbox retry。 |
| `db/mirror.ts` | Mirror event、HMAC、outbox delivery、版本及重播保護。 |
| `app/api/internal/mirror/route.ts` | OpenAI Sites signed receiver。 |
| `app/runtime-mode.ts`、`app/site-mode-client.tsx` | 唯讀 runtime 開關及 UI mode。 |
| `drizzle/0002_empty_ultron.sql` | Outbox、receiver version 和 applied-event tables。 |
| `vite.config.ts` | 保留原有 Sites／本機 binding；只有 `CLOUDFLARE_DEPLOY=1` 時使用獨立 Cloudflare config。 |

## 6. Relevant commits

| Commit | Summary |
| --- | --- |
| `5839f0f` | Add home screen app icon |
| `492a688` | Add automatic ruby to imported lyrics |
| `3a5be7c` | Add offline learning support |
| `5f4ee71` | Keep imported lessons visible when sources fail |
| `e697ed8` | Unify grammar lesson headings |
| `fc226c9` | Make iOS lessons offline first |
| `5b9d6b0` | Fix offline lesson navigation on iPhone |
| `f3972c2` | Add resilient YouTube background playback handoff |
| `6de5ca8` | Add floating YouTube resume control |
| `793ce21` | Fix iPhone login cache and repeated player resume |
| `50e48ae` | Require stable YouTube resume playback |
| `240cc5f` | Preserve repeated iPhone player resume |
| `5ba455b` | Handle ambiguous ruby reading boundaries |
| `bce0206` | Fix lesson phrase and ruby imports |
| `7f20443` | Sort songs by Japanese title reading |
| `fce8a7e` | Handle annotated Futaba title reading |
| `a0c650d` | Sort titles with embedded kana annotations |
| `ab58d9b` | Show plain titles in song directory |
| `489c1a8` | Read title kana from imported lessons |
| `20824bd` | Keep title readings hidden from lessons |
| `67ec50d` | Add Cloudflare Workers deployment |
| `dd2a49a` | Add resilient OpenAI Sites mirror |

## 7. Validation already performed

For the latest production source:

- `vinext build`: passed.
- ESLint: passed.
- Node test runner: 21/21 passed.
- `public/sw.js` syntax check: passed.
- `git diff --check`: passed.
- Temporary player lifecycle test route was deleted before commit/deploy.
- OpenAI Sites version 27 temporarily exposed an authenticated backup page;
  version 28 removed it after the one-time copy. Version 29 is now active in
  read-only mirror mode using environment revision 4.
- Production browser verification confirmed「スーパーガール」和「スケッチ」課文標題都沒有 ruby／括號假名；歌曲目錄亦只顯示純歌名。
- Cloudflare build、Wrangler dry-run、TypeScript、ESLint、21/21 tests、service-worker syntax 和 `git diff --check` 均通過。
- Cloudflare 未登入頁已在 Browser 確認；`/api/auth/status` 回報 `configured: true`，未登入 `/api/songs` 正確回應 401。
- Cloudflare `site.webmanifest`、`sw.js`、icons 和 OG image 均回應 200；remote D1 `songs` table 及 migrations 已存在。
- Cloudflare remote D1 contains 21 songs with 21 unique slugs, matching the
  authenticated Sites backup taken on 2026-08-03.
- Authenticated Browser verification confirmed 21 lessons, 217 grammar items,
  598 vocabulary items, the full lesson view, live YouTube iframe, import page,
  manage page, grammar index and vocabulary index.
- OpenAI Sites version 29 / environment revision 4 已確認有 21 首歌、217 個文法
  項目及 598 個生字；首頁、header、footer 和索引沒有匯入連結，直接開
  `/import` 或 `/songs/:slug/manage` 會返回首頁；mutation API 回應 403。
- Cloudflare remote migration `0002_empty_ultron.sql` 已套用；主 Worker version
  `a10b19b6-8c11-4fa3-bde8-8260b8a86008` 和 retry Worker version
  `74cbf77b-e6b0-4e80-b9b4-bfc9e3dae50f` 已發布。
- 以一首現有歌曲作內容不變的 signed end-to-end sync：receiver 成功接收 1
  個 event，failed/invalid 均為 0，Cloudflare outbox 回到 0；兩邊仍是 21 首
  唯一歌曲，OpenAI Sites UI 沒有重新出現管理入口。
- 最新 validation：vinext normal/Cloudflare builds、TypeScript、ESLint、Wrangler
  dry-runs、service-worker syntax、`git diff --check` 及 21/21 tests 均通過。

## 8. Known limitations and trade-offs

1. **iOS autoplay policy remains authoritative.** A web app cannot force background playback or guaranteed auto-resume. The floating button is the deliberate fallback requiring a user gesture.
2. **YouTube Premium does not automatically grant background playback to a third-party iframe.** Premium background play normally applies in the native YouTube app. The YouTube logo in the iframe can still open the native app.
3. **No automatic Picture in Picture on iPhone.** Safari/iOS and YouTube control PiP availability and require user interaction; the app does not force PiP when the iframe scrolls offscreen.
4. **Resume storage is per-tab.** `sessionStorage` does not survive every tab close/browser kill and expires logically after 6 hours.
5. **Four-second grace trade-off.** If a user intentionally pauses and switches apps within four seconds, the fallback button may still appear on return. This is preferable to losing resume intent during the iPhone pause-before-hide race.
6. **YouTube lifecycle events are not fully deterministic.** If physical iPhone reports another failure, add temporary diagnostics around event order rather than immediately lengthening timers.
7. **`npm test` imports `tsx` although it is currently transitive in `package-lock.json`.** A clean npm install should hoist it, but adding `tsx` explicitly to `devDependencies` would make the test dependency less fragile.
8. **50 音準確度依賴 `titleReading`。** 新 AI 課文應在最後一行提供完整平假名讀音；舊課文缺少此欄時只可使用內嵌讀音、現有 fallback 或原歌名，漢字歌名的排序未必準確。
9. **Mirror 是單向的。** 正常操作只可在 Cloudflare 主站修改。OpenAI
   failover 期間的修改要在恢復 mirror 前人工 reconcile。
10. **Cron retry 最長可能延遲約 5 分鐘。** 正常修改會即時傳送；只有即時
    request 失敗才依賴 retry schedule 和 exponential backoff。

## 9. Recommended next steps if the physical iPhone still fails

1. Ask for the exact sequence: Safari tab vs Add-to-Home-Screen PWA, whether the YouTube logo opened the native app, how long the other app stayed open, and whether Safari reloaded the page.
2. Re-test in a 393×852 viewport with an actual YouTube iframe, but do not treat viewport emulation as proof of physical Safari behavior.
3. Add temporary, privacy-safe lifecycle diagnostics for `visibilityState`, `focus/blur`, `pagehide/pageshow`, YT state, resume intent and elapsed time. Do not log password, cookies or full URLs containing private data.
4. If Safari kills/reloads the tab, consider moving the minimal resume marker from `sessionStorage` to `localStorage`, with strict age cleanup and video-ID scoping.
5. If event order remains inconsistent, prefer a conservative rule: once playback was confirmed, preserve a pending resume marker across any blur/pagehide until the next stable playback or an intentional visible pause has remained unchanged beyond the grace period.

## 10. Local development and deployment notes

Normal local setup:

```bash
npm install
cp .env.example .dev.vars
npm run dev
```

Validation:

```bash
npm run build
npm run lint
npm test
node --check public/sw.js
git diff --check
```

This project contains `.openai/hosting.json`, so production changes should use the Sites build and hosting flow:

1. Build and validate the exact source.
2. Commit the validated source.
3. Push the exact commit to GitHub and the Sites source repository.
4. Package the existing vinext build with the Sites packaging helper.
5. Save a site version using the pushed commit SHA.
6. Deploy that saved version and poll until `succeeded`.

Cloudflare deployment additionally requires：

1. Apply pending D1 migrations to `uta-nihongo-davetchiu-db`。
2. 用 `CLOUDFLARE_DEPLOY=1` build 後 deploy 主 Worker。
3. 如有修改 retry code/config，再用 `wrangler.mirror.jsonc` deploy retry Worker。
4. Secrets 必須用平台 secret flow 更新，不可放入 Wrangler config。更新
   `MIRROR_SECRET` 時，三個 runtime 必須使用同一新值。

Sites source credentials are short-lived. Obtain a fresh credential when required; never store its token in Git config, remotes, logs or this file.

## 11. Quick handover checklist

- Read `README.md`, this file, `app/youtube-player.tsx`, `app/login-client.tsx`, `public/sw.js` and the final YouTube test block in `tests/import-parser.test.ts`.
- Run `git status -sb` and confirm `main` is clean and tracking `origin/main`.
- Before touching authentication, inspect Sites environment configuration; never infer or overwrite the existing secret value.
- Before changing service-worker behavior, test both authenticated online navigation and offline lesson navigation on iPhone-sized viewport.
- Before changing resume behavior, test at least three consecutive cycles, not only the first return.
- `titleReading` 只供排序；不要重新加到目錄卡片或課文標題。新增課文格式時保留最後一行 `歌名讀音：……`。
- 正常只可在 Cloudflare 主站修改課文；檢查 `mirror_outbox` 應保持 0 或短暫待送。
- OpenAI Sites 必須保持 `MIRROR_READ_ONLY=1`，除非正式進行 failover。
- Failover 後重新啟用 mirror 前，先人工 reconcile OpenAI Sites 期間的修改。
- Treat the deployed URL as production; do not use it for destructive test data.

## 12. Current dual-hosting deployment

Status as of 2026-08-03:

- Primary Worker: `uta-nihongo-davetchiu`
- Primary URL: <https://uta-nihongo-davetchiu.d-chiu.workers.dev>
- Primary Worker version: `a10b19b6-8c11-4fa3-bde8-8260b8a86008`
- Retry Worker: `uta-nihongo-mirror-retry`
- Retry Worker code version: `74cbf77b-e6b0-4e80-b9b4-bfc9e3dae50f`
- Retry Worker current secret-change version: `0069df36-cf43-4e32-a718-fb027835df5b`
- Retry schedule: `*/5 * * * *`
- OpenAI mirror: <https://uta-nihongo-davetchiu.davechiu.chatgpt.site>
- OpenAI Sites version: 29; environment revision: 4
- Deployed source commit: `dd2a49a` (`main`, pushed to GitHub and Sites source)
- D1: `uta-nihongo-davetchiu-db`
- D1 ID: `133398ee-df1d-4a55-a7ea-1f88e418f83e`
- D1 location: APAC; logical binding remains `DB`.
- Migrations `0000`, `0001` and `0002` were applied successfully.
- Cloudflare D1 has 21 songs / 21 unique slugs; outbox was 0 after the final
  end-to-end validation.

Both sites keep the existing password gate. `SITE_PASSWORD` and
`MIRROR_SECRET` are platform secrets and were not committed or documented.
Physical iPhone PWA/offline behavior still requires owner testing; desktop
Browser checks do not prove physical Safari behavior.
