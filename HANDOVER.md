# 聽歌學日文 — Handover Notes

最後更新：2026-08-05（Asia/Hong_Kong）

## 1. Current snapshot

- GitHub content repository: <https://github.com/davetwchiu/learn-japanese-with-songs>
- Primary full-function site: <https://uta-nihongo-davetchiu.d-chiu.workers.dev>
- OpenAI read-only mirror: <https://uta-nihongo-davetchiu.davechiu.chatgpt.site>
- Git branch: `main`
- Cloudflare deployed source HEAD: `cd3b721`
- OpenAI Sites project ID: `appgprj_6a6c04056b208191bd5167021ce39a3e`
- Latest deployed Sites version: 41
- Hosted environment revision: 4
- Storage: D1 binding `DB`; no R2 binding
- Access: public Sites URL，另有 app-owned password gate

現時 Git `origin` 是上方 GitHub repository。Cloudflare Worker 和 OpenAI
Sites version 41 都使用 commit `cd3b721`。Cloudflare 是唯一正常寫入來源；
OpenAI Sites 以 `MIRROR_READ_ONLY=1` 運行，會隱藏匯入／管理入口並拒絕
POST、PATCH、DELETE，但相關程式碼沒有刪除。兩個 D1 仍是獨立 database，
由已簽署的單向同步保持內容一致。

Runtime 發佈完成後另有一個只更新本文件的 Git commit；依 documentation-only
規則沒有為該 commit 重複 deploy。兩個站的 runtime source 仍完全相同，都是
已完整驗證的 `cd3b721`。

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
- Vocabulary 的 `partOfSpeech`、`meaning`、`note`、`exampleJp` 和 `exampleZh`
  現在全部經同一個 ruby renderer。載入／匯入時亦會把 `漢字（かな）` 正規化
  為 `[漢字]{かな}`，因此中日混合例句即使被 parser 分到 `exampleZh`，亦不會
  再把括號假名直接顯示。此修正不需要重寫既有 D1 song JSON。
- 保留 lyric notes、支援 lesson management。
- Grammar lesson heading 已統一，並加入 D1 migration `0001_normalize_grammar_titles.sql`。

### 3.5 Japanese gojūon song ordering and title readings

- 歌曲目錄不再按匯入／更新日期排列，改為按歌名讀音的日文 50 音順序。
- `Song.titleReading` 是純排序 metadata，不應在歌曲目錄或課文標題顯示。
- AI 課文格式最後一行現規定為 `歌名讀音：完整平假名讀音`；網站 parser 會自動讀取，不再要求使用者在匯入表單另填假名。
- Parser 會把 Markdown 最後一個非空白行的 `歌名讀音：……` 分離為 sorting metadata；課文頁（包括未能結構化解析而顯示原文的課文）不會顯示該行。
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
2. 重新 deploy 最新已儲存的 production version（目前是 version 41），令新
   environment revision 生效。
3. 確認 `/import` 和課文的「管理課文與影片」連結重新出現；現有相同原始碼
   即恢復匯入、更新和刪除功能，無需改 code。
4. Failover 期間在 OpenAI Sites 的修改不會反向同步。Cloudflare 恢復後，
   必須先人工把差異 reconcile 回 Cloudflare，才可重新設定
   `MIRROR_READ_ONLY=1`；否則 Cloudflare 之後的事件可能覆蓋 failover 修改。

### 3.7 Resilient login and logout removal

部分 Safari／PWA 裝置輸入正確密碼後會一直停在「登入中」。舊流程在 login
API 成功後，會無限期等待 Cache Storage 清理完成才 reload；裝置的離線 API
如果沒有 resolve，畫面便看似完全沒有反應。另一個風險是舊 login HTML 如果
未能 hydrate，原本沒有 `action` 的 form 不能自行提交。

現時行為：

- Login request 最長等待 15 秒，逾時會顯示可理解的網絡錯誤。
- 成功後會刪除所有 `uta-nihongo-offline-*` cache 並 unregister 舊 service
  worker，但最多只等 1.2 秒，任何裝置都不會被清理流程永久卡住。
- 成功後用帶 timestamp 的 `/` URL 作 hard navigation，避開舊 login document。
- Login form 有原生 `action`、`method` 和 input `name`；即使 client JavaScript
  或舊 bundle 未能載入，browser 仍可直接 POST 密碼。成功會以 303 + session
  cookie 返回首頁；失敗會顯示簡單錯誤頁。
- Auth status、成功的 JSON login，以及 native-form 的成功／失敗 response
  都使用 `Cache-Control: no-store`。
- Service worker cache 升級至 `uta-nihongo-offline-v3`，首次載入會清除 v2。
- Owner 不需要手動登出，因此 header 的「登出」、client logout flow、
  `/api/auth/logout` handling 和 cookie-clear helper 已全部移除。現有 session
  cookie 仍按原設定最多 7 日後失效。

### 3.8 Aimyon homepage artwork

- 首頁右側主視覺保留原有 HTML/CSS 海報：文字、ruby、聲波、方格、紅色圓形
  和綠色圓環仍是獨立可編輯元素。
- Aimyon 原相只作 absolute background layer；CSS 使用低飽和、低對比、提高
  亮度及 22% opacity，文字和圖形維持清晰前景。
- 相片已轉成 1200×900 WebP，約 49 KB；`object-position` 可獨立微調人物位置。
- 先前把整張合成海報做成單一 bitmap 的版本已移除；Git history 仍可復原。
- Service worker core cache 包含 `/aimyon-poster-background.webp`，離線首頁亦可顯示。

### 3.9 Sticky mobile lesson menu

- Tablet／iPhone 課文目錄仍保留在 inline player 下方，未到達主導覽列前會隨
  課文正常捲動。
- 目錄到達 sticky 主導覽列底部後會固定在其下；使用者向上捲回 player 時會
  自然返回原位，沒有複製第二條目錄或加入 JavaScript observer。
- 橫向捲動移到目錄內的 `nav`，避免 scroll container 影響外層 sticky。
- Mobile grid 內的 `.lesson-toc` 使用 `min-width: 0`，令目錄 track 不會被按鈕
  的 intrinsic width 撐闊；左右滑動只發生在內層 `nav`，課文保持不動。
- 為使 iPhone 點擊 anchor 後仍可靠地固定目錄，mobile `.lesson-layout` 改為
  block flow；`.lesson-toc` 的 sticky containing block 因而涵蓋整篇課文，不會
  被 CSS grid 的 anchor reflow 帶走。
- Tablet offset 是 82px，iPhone breakpoint 是 72px；章節 anchor 亦預留兩條
  導覽列的高度，避免點擊後標題被遮住。

### 3.10 Fixed lesson player controls

- 有 YouTube 影片的課文頁底部新增 fixed control bar，頁面捲動時仍保持可用；
  沒有影片的課文不會 render control bar。
- Control bar 有播放、暫停、倒退 5 秒及快進 5 秒。所有操作都經既有
  YouTube IFrame API player instance，沒有直接找 iframe 或操作 iframe DOM。
- `YouTubePlayer` 以 imperative handle 對外提供 `play()`、`pause()` 和
  `seekBy()`；獨立 `PlayerControlBar` 使用同一 handle，沒有建立第二個 player。
- IFrame API `onReady` 前四個按鈕全部 disabled；按鈕有中文 `aria-label`，
  control bar 有 toolbar label，touch target 是 46px。
- Control bar 和原有 iPhone resume 浮動鍵都使用 safe-area inset。浮動鍵已上移，
  不會蓋住 control bar；有播放器的課文亦增加 bottom padding，避免最後一段內容
  被 fixed bar 遮住。
- 原有 sessionStorage、stable playback verification、4 秒 pause grace、
  autoplay-blocked fallback 及 lifecycle listeners 保持不變。
- Play／Pause 會持續反映 YouTube IFrame API 的實際 state：`PLAYING` 時 Play
  button 保持橙色，`PAUSED` 時 Pause button 保持橙色；從 inline iframe 直接操作
  亦會同步。Buffering 不會清除上一個明確狀態，ended 則清除 highlight。
- Play／Pause 使用 `aria-pressed` 同步暴露 active state，視覺和輔助技術都能
  分辨目前狀態。

### 3.11 Markdown lesson editing

- 「管理課文」新增「修正課文」區塊，會顯示可直接編輯的 Markdown 和
  「儲存變更」按鈕。
- 新匯入的課文會保存原始 Markdown；既有課文會從結構化資料產生一份可重新
  匯入的標準 Markdown，確保所有課文均可修改。
- 儲存時會重新解析 Markdown 並更新課文內容，同時保留既有 slug、發布日期及
  YouTube 設定；更新會照既有流程寫入 mirror outbox。

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
| `app/youtube-player.tsx` | YouTube IFrame API wrapper、lifecycle/resume state、imperative control handle、fixed control bar、4-second pause grace、floating-button state 和 runtime guards。 |
| `app/site-client.tsx` | 課堂頁共用 `YouTubePlayer` handle 及按影片條件 render `PlayerControlBar`；亦包含 offline registration、lesson asset caching、manual refresh flow、純歌名和首頁海報。 |
| `app/globals.css` | Player layout、fixed control bar、floating resume button、safe-area/mobile styles、內容 bottom spacing、sticky mobile lesson menu（含 anchor-safe block flow）、offline UI styles及 Aimyon photo background。 |
| `app/login-client.tsx` | 登入成功後清除 cached login/navigation documents，然後 reload。 |
| `public/sw.js` | Offline cache、network-first navigation、cache version bump、API exclusions、refresh bypass 和 fallback page。 |
| `tests/import-parser.test.ts` | Parser、歌名讀音、50 音排序、純歌名、ruby、offline、PWA、homepage artwork、login fallback、logout removal、YouTube resume、fixed controls 及 active playback state assertions；目前共 27 tests。 |
| `public/aimyon-poster-background.webp` | 首頁海報的 Aimyon 淡色背景相片，1200×900、約 49 KB；文字和圖形不在此 bitmap 內。 |
| `app/api/auth/[action]/route.ts` | JSON login、無 JavaScript native-form fallback、no-store response；不再提供 logout。 |
| `app/import-parser.ts` | Flexible lesson parsing、自動 ruby、inflection handling；讀取課文最後的 `歌名讀音：`。 |
| `app/import/import-client.tsx` | Import UI 配合 parser/ruby 行為；不再要求使用者另填歌名假名。 |
| `app/song-data.ts` | Source failure fallback、grammar-title normalization、vocabulary ruby normalization、50 音排序、片假名正規化、現有讀音 fallback 和 `plainSongTitle()`。 |
| `聽歌學日文_AI課文格式範本.md`（repo 外） | 規定 AI 在整份課文最後一行輸出 `歌名讀音：完整平假名讀音`；網站不直接部署此檔案。 |
| `app/layout.tsx` | PWA manifest、icons 和相關 metadata。 |
| `public/site.webmanifest` | Standalone PWA metadata。 |
| `public/apple-touch-icon.png` | iPhone home-screen icon。 |
| `public/icon-512.png` | PWA 512px icon。 |
| `drizzle/0001_normalize_grammar_titles.sql` | D1 grammar-title data migration。 |
| `drizzle/meta/0001_snapshot.json` | Migration snapshot。 |
| `drizzle/meta/_journal.json` | Migration journal update。 |
| `.openai/hosting.json` | Sites project ID、D1 logical binding、no R2。 |
| `wrangler.jsonc` | Cloudflare Worker、assets、APAC D1、compatibility date 和 observability 設定；平台已預設 Node.js compatibility，不再顯式加入 `nodejs_compat`。 |
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
| `5a06b8e` | Make login resilient and remove logout |
| `6103e65` | Fix vocabulary ruby rendering |
| `7cbd495` | Add Aimyon homepage artwork |
| `cafbee6` | Layer Aimyon photo behind homepage poster |
| `02581e6` | Keep mobile lesson menu visible |
| `56dc047` | Contain mobile lesson menu scrolling |
| `19a7eff` | Add fixed lesson player controls |
| `a596711` | Use default Node compatibility mode |
| `d3792df` | Reflect YouTube playback state in controls |
| `ff27abd` | Add Markdown lesson editing |
| `6397f95` | Hide title readings from lesson content |
| `cd3b721` | Stabilize mobile lesson menu anchors |

## 7. Validation already performed

For the latest production source:

- `vinext build`: passed.
- ESLint: passed.
- Node test runner: 25/25 passed.
- `public/sw.js` syntax check: passed.
- `git diff --check`: passed.
- Temporary player lifecycle test route was deleted before commit/deploy.
- OpenAI Sites version 27 temporarily exposed an authenticated backup page;
  version 28 removed it after the one-time copy. Version 30 is now active in
  read-only mirror mode using environment revision 4.
- Production browser verification confirmed「スーパーガール」和「スケッチ」課文標題都沒有 ruby／括號假名；歌曲目錄亦只顯示純歌名。
- Cloudflare build、Wrangler dry-run、TypeScript、ESLint、22/22 tests、service-worker syntax 和 `git diff --check` 均通過。
- Cloudflare 未登入頁已在 Browser 確認；`/api/auth/status` 回報 `configured: true`，未登入 `/api/songs` 正確回應 401。
- Cloudflare `site.webmanifest`、`sw.js`、icons 和 OG image 均回應 200；remote D1 `songs` table 及 migrations 已存在。
- Cloudflare remote D1 contains 21 songs with 21 unique slugs, matching the
  authenticated Sites backup taken on 2026-08-03.
- Authenticated Browser verification confirmed 21 lessons, 217 grammar items,
  598 vocabulary items, the full lesson view, live YouTube iframe, import page,
  manage page, grammar index and vocabulary index.
- OpenAI Sites version 30 / environment revision 4 已確認有 21 首歌、217 個文法
  項目及 598 個生字；首頁、header、footer 和索引沒有匯入連結，直接開
  `/import` 或 `/songs/:slug/manage` 會返回首頁；mutation API 回應 403。
- Cloudflare remote migration `0002_empty_ultron.sql` 已套用；主 Worker version
  `a67834eb-6638-4297-8c4d-6ea2a4ad9df1` 和 retry Worker version
  `74cbf77b-e6b0-4e80-b9b4-bfc9e3dae50f` 已發布。
- 以一首現有歌曲作內容不變的 signed end-to-end sync：receiver 成功接收 1
  個 event，failed/invalid 均為 0，Cloudflare outbox 回到 0；兩邊仍是 21 首
  唯一歌曲，OpenAI Sites UI 沒有重新出現管理入口。
- 兩個 production URL 都已核對 native form attributes；錯誤密碼的 native
  fallback 回應 401 HTML、JSON flow 回應 401 JSON、舊 logout endpoint 回應
  404，而且 `sw.js` 均為 v3。
- 最新 validation：vinext normal/Cloudflare builds、TypeScript、ESLint、Wrangler
  dry-runs、service-worker syntax、`git diff --check` 及 22/22 tests 均通過。
- Ruby fix validation：vinext normal/Cloudflare builds、TypeScript、ESLint、
  Wrangler dry-run、service-worker syntax、`git diff --check` 及 24/24 tests
  均通過。OpenAI Sites version 31 / environment revision 4 已在 Browser 驗證
  「ラッキーカラー」首四張生字卡沒有任何括號假名；`意味`、`勘違`、`今日中`、
  `仕事`、`終`、`迎`、`朝`、`最終日` 均是 native ruby/rt。Mirror 仍沒有匯入
  或管理入口；Cloudflare D1 現有 22 首唯一歌曲，`mirror_outbox` 為 0。
- Aimyon HTML/CSS background validation：normal／Cloudflare builds、TypeScript、
  ESLint、Wrangler dry-run、service-worker syntax、`git diff --check` 及 24/24
  tests 均通過。約 49 KB background asset 在兩個 production URL 的 GET 均回應
  200，並已加入 offline core cache；OpenAI Sites version 33 繼續使用
  environment revision 4／唯讀模式，Cloudflare version 為
  `b1cabb6b-90d9-4340-9b44-b62e4f8fede4`。
- Sticky lesson menu validation：normal／Cloudflare builds、TypeScript、ESLint、
  24/24 tests、兩個 Wrangler dry-run、service-worker syntax 及
  `git diff --check` 均通過。兩個 production URL 均回應 200，實際 production
  CSS 均包含 tablet 82px／iPhone 72px sticky offset；OpenAI Sites version 34
  使用 environment revision 4 並保持 `MIRROR_READ_ONLY=1`，Cloudflare version
  為 `a0dbfc1c-7cd8-407f-8b07-e6c9901cc6f3`。Cloudflare D1 有 23 首歌／23 個
  unique slug，`mirror_outbox` 為 0。
- Contained mobile menu validation：normal／Cloudflare builds、TypeScript、
  ESLint、24/24 tests、兩個 Wrangler dry-run、service-worker syntax 及
  `git diff --check` 均通過。兩個 production URL 和其 CSS asset 均回應 200，
  CSS 實際包含 `.lesson-toc` 的 `min-width: 0`；OpenAI Sites version 35 使用
  environment revision 4 並保持 `MIRROR_READ_ONLY=1`，Cloudflare version 為
  `83c28c79-a7dc-47ce-9555-2338d03d2c0d`。Cloudflare D1 仍有 23 首歌／23 個
  unique slug，`mirror_outbox` 為 0。
- Fixed player controls validation：normal／Cloudflare builds、TypeScript、
  ESLint、25/25 tests、兩個 Wrangler dry-run、service-worker syntax 及
  `git diff --check` 均通過。Control bar tests 覆蓋共用 imperative handle、
  play／pause／±5 秒、ready 前 disabled、accessibility labels、無影片時不 render、
  fixed positioning、safe-area inset 及課文 bottom spacing。
- Production control validation：Cloudflare 及 OpenAI Sites 的實際課文頁都顯示
  四個 control；Cloudflare 以 Chrome 實測 play 後 iframe 進入 playing、back／
  forward 可操作、pause 後回到 paused。393×852 viewport 下四個 touch target
  均為 46×46px，control bar 沒有越出 viewport，課文 bottom padding 是 160px。
  Owner 亦在實際頁面回報「checked ok」。OpenAI Sites version 37 使用 environment
  revision 4，`MIRROR_READ_ONLY=1`，首頁和課文沒有匯入／管理入口。
- OpenAI Sites version 36 曾因平台在 2026-08-04 把 Node.js compatibility 改為
  預設而拒絕舊的顯式 `nodejs_compat` flag；`a596711` 把兩個 Wrangler config 和
  Sites local build 改用 2026-08-04 default compatibility。重新完成所有 validation
  後，version 37 成功發佈。Cloudflare 主 Worker version 是
  `785082ff-507f-41e1-b291-60a496f2028c`；remote D1 有 23 首歌／23 個 unique slug，
  `mirror_outbox` 為 0。
- Playback-state highlight validation：normal／Cloudflare builds、TypeScript、
  ESLint、25/25 tests、兩個 Wrangler dry-run、service-worker syntax 及
  `git diff --check` 均通過。兩個 production 課文頁均確認初始狀態沒有 active
  button；播放後 Play 的 `aria-pressed` 變為 true 並保持橙色，暫停後 active
  state 和橙色轉到 Pause。OpenAI Sites version 38 使用 environment revision 4
  並保持 `MIRROR_READ_ONLY=1`；Cloudflare 主 Worker version 是
  `0f70a113-4c3a-4a62-8c45-02934d4d3328`。兩邊 runtime source 都是
  `d3792df`；Cloudflare D1 有 23 首歌，`mirror_outbox` 為 0。
- Markdown lesson editing validation：normal／Cloudflare builds、TypeScript、
  ESLint、service-worker syntax、Wrangler dry-run 及 `git diff --check` 均通過；
  automated tests 為 26/26。local browser flow 已實測匯入課文、在「修正課文」
  顯示原始 Markdown、修改／儲存和重新開啟課文，更新內容正確顯示。
- Release validation（`ff27abd`）：OpenAI Sites version 39／environment revision 4
  和 Cloudflare Worker version `b252a397-7f82-41a3-a66e-7a753751fc75` 均已發佈。
  Mirror 直接開管理頁會返回首頁、mutation API 回應 403；Cloudflare
  `/api/auth/status` 回應 configured true。Cloudflare remote D1 有 23 首歌／23 個
  unique slug，`mirror_outbox` 為 0。
- Title-reading display fix validation（`6397f95`）：normal／Cloudflare builds、
  TypeScript、ESLint、service-worker syntax、Wrangler dry-run、`git diff --check`
  及 27/27 tests 均通過；新增測試確認未結構化 Markdown 課文最後的
  `歌名讀音：……` 只會保存作排序資料，不會進入課文頁顯示的原文。OpenAI
  Sites version 40／environment revision 4 和 Cloudflare Worker version
  `78c2bc4c-dee2-4583-8c4e-4943c03ed468` 均已發佈；Cloudflare remote D1 沒有 pending migrations。
- Mobile lesson anchor validation（`cd3b721`）：normal／Cloudflare builds、
  TypeScript、ESLint、service-worker syntax、Wrangler dry-run、`git diff --check`
  及 27/27 tests 均通過。mobile CSS 把 lesson layout 改為 block flow，目錄使用
  sticky containing block 覆蓋整篇課文；兩個 production URL 均回應 200，實際
  CSS 均包含該結構。OpenAI Sites version 41／environment revision 4 保持
  `MIRROR_READ_ONLY=1`；Cloudflare Worker version 為
  `c05c72d7-cbb2-4bd3-8ed3-b189a74398f1`。Cloudflare D1 有 24 首歌／24 個
  unique slug，`mirror_outbox` 為 0。

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

### Production rule for code changes

歌曲內容更新與程式更新是兩條不同流程：

- 在 Cloudflare 主站匯入、修改或刪除歌曲，只會產生 data event；既有 mirror
  會自動把內容同步到 OpenAI Sites，兩邊都不需要重新 deploy。
- 任何會改變網站程式、UI、API、database schema、build config 或 Worker 的
  code change，如獲指示部署到 production，必須以**同一個已驗證 commit**
  同時部署 Cloudflare 主站和 OpenAI Sites 鏡像。除非是已記錄的 emergency
  hotfix，否則不可只部署其中一邊後便當作完成。
- OpenAI Sites 部署後必須繼續使用 `MIRROR_READ_ONLY=1`；code 內的匯入／
  管理功能仍保留，只由 runtime mode 隱藏和封鎖 mutation。
- 如只改 documentation、tests 或不會進入 runtime artifact 的檔案，可不重新
  deploy，但仍要清楚記錄 deployed commit 與 Git HEAD 的差別。
- 每次修改 `HANDOVER.md`，必須在同一個 task commit 並 push 到 GitHub
  `origin/main`。只有遠端 branch 已確認包含該 commit 才算完成；如果 GitHub
  暫時不可用，必須明確回報尚未同步，不可只留下本機修改。

建議 production code release 次序：

1. 完成 normal Sites build、Cloudflare build、TypeScript、ESLint、tests、
   service-worker syntax、Wrangler dry-runs 和 `git diff --check`。
2. Commit 後把同一 SHA push 到 GitHub `main` 和 OpenAI Sites source branch。
3. 如果 receiver、event schema 或共用 API contract 有改，先部署向後兼容的
   OpenAI Sites receiver；其他 UI-only change 亦可先部署 Sites，減少兩邊版本
   不一致的時間。
4. Package、save 及 deploy OpenAI Sites，poll 至 `succeeded`，並確認
   environment revision 正確及 `MIRROR_READ_ONLY=1` 仍生效。
5. 套用所有 pending Cloudflare D1 migrations，再以同一 commit build/deploy
   Cloudflare 主 Worker。
6. 如 `worker/mirror-retry.ts`、`db/mirror.ts` 或 `wrangler.mirror.jsonc` 有改，
   同一 release 亦要部署 retry Worker；secret 只可經平台 secret flow 更新。
7. 在 Browser 驗證 Cloudflare 保留完整管理功能、OpenAI Sites 沒有管理入口；
   檢查兩邊歌曲數量及一首實際課文。
8. 執行一次內容不變的 signed sync 或等候下一個真實更新，確認 delivered、
   failed、invalid 和 `mirror_outbox` 狀態；最後把 version、environment revision、
   commit 及測試結果寫回本文件。

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
- `HANDOVER.md` 有任何修改時，確認修改已 commit/push，並以
  `origin/main` 的 SHA 或內容核對 GitHub 已同步。
- Before touching authentication, inspect Sites environment configuration; never infer or overwrite the existing secret value.
- Before changing service-worker behavior, test both authenticated online navigation and offline lesson navigation on iPhone-sized viewport.
- Before changing resume behavior, test at least three consecutive cycles, not only the first return.
- `titleReading` 只供排序；不要重新加到目錄卡片或課文標題。新增課文格式時保留最後一行 `歌名讀音：……`。
- 正常只可在 Cloudflare 主站修改課文；檢查 `mirror_outbox` 應保持 0 或短暫待送。
- OpenAI Sites 必須保持 `MIRROR_READ_ONLY=1`，除非正式進行 failover。
- Failover 後重新啟用 mirror 前，先人工 reconcile OpenAI Sites 期間的修改。
- Treat the deployed URL as production; do not use it for destructive test data.

## 12. Current dual-hosting deployment

Status as of 2026-08-05:

- Primary Worker: `uta-nihongo-davetchiu`
- Primary URL: <https://uta-nihongo-davetchiu.d-chiu.workers.dev>
- Primary Worker version: `c05c72d7-cbb2-4bd3-8ed3-b189a74398f1`
- Retry Worker: `uta-nihongo-mirror-retry`
- Retry Worker code version: `74cbf77b-e6b0-4e80-b9b4-bfc9e3dae50f`
- Retry Worker current secret-change version: `0069df36-cf43-4e32-a718-fb027835df5b`
- Retry schedule: `*/5 * * * *`
- OpenAI mirror: <https://uta-nihongo-davetchiu.davechiu.chatgpt.site>
- OpenAI Sites version: 41; environment revision: 4
- Deployed source commit: `cd3b721` (`main`, pushed to GitHub and Sites source)
- D1: `uta-nihongo-davetchiu-db`
- D1 ID: `133398ee-df1d-4a55-a7ea-1f88e418f83e`
- D1 location: APAC; logical binding remains `DB`.
- Migrations `0000`, `0001` and `0002` were applied successfully.
- Cloudflare D1 has 24 songs / 24 unique slugs; outbox was 0 after the final
  end-to-end validation.
- Runtime source on both hosts is `cd3b721`; the following Git HEAD is a
  documentation-only handover update and was intentionally not redeployed.

Both sites keep the existing password gate. `SITE_PASSWORD` and
`MIRROR_SECRET` are platform secrets and were not committed or documented.
Physical iPhone PWA/offline behavior still requires owner testing; desktop
Browser checks do not prove physical Safari behavior.
