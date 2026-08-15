# Repo Inbox — あいみょん香港 Apple Music 日文／英文歌名對照

日期：2026-08-16

## 任務結果

已整理あいみょん曲目母表，共 102 個不重複歌名，按日文讀音五十音排序。

整理口徑：

- 同一歌曲的單曲版、專輯版及現場重收錄合併為一個題名。
- Instrumental／純伴奏不列入主清單。
- 保留正式發行、B-side／EP、獨立時期作品，以及有正式音源或目錄依據的現場／特典曲。
- 英文名稱以香港 Apple Music storefront 顯示名為準；不自行把平台名稱改成較自然英文。
- Apple Music 保留日文題名者照錄日文。
- 香港目錄未能獨立配對者明確標記，不自行翻譯冒充官方英文名。

## 統計

- 總題名：102
- 英文／羅馬字顯示：84
- 香港 Apple Music 仍顯示日文：16
- 未能直接配對：2

## 已生成檔案

本次 ChatGPT 工作階段已生成：

- `aimyon_hk_apple_music_japanese_english_gojuon.xlsx`
- `aimyon_hk_apple_music_japanese_english_gojuon.csv`

Excel 有三個工作表：

1. `五十音總表`：讀音、日文原名、香港 Apple Music 顯示名、命名方式、收錄類別、核對狀態、備註及搜尋連結。
2. `核對說明`：收錄口徑及命名規則。
3. `特殊項目`：預發行、搜尋容易誤配及香港目錄未能直接配對的項目。

注意：上述 XLSX／CSV 是本次 ChatGPT sandbox 產物，並未以 binary file 直接提交到 GitHub。Codex 如需在 repo 使用完整資料，應從此 handoff 的整理口徑重建／匯入資料，或由使用者提供 XLSX／CSV 檔案。

## 特殊核對項目

- `ビーナスベルト` → `Belt of Venus`：香港 Apple Music 目錄已出現；當時標示發行日 2025-10-22。
- `おじゃまします` → `May I come in?`：香港 Apple Music 目錄已出現；當時標示發行日 2025-10-22。
- `わかってない` → `Wakattenai`：批次搜尋曾誤配其他藝人，採香港目錄一貫羅馬字形式，需視為高可信但曾需人工反查的項目。
- `彼氏有無` → `Kareshi Umu`：批次搜尋曾誤配其他藝人，按題名讀音及目錄命名方式整理。
- `傷と悪魔と恋をした！`：香港 Apple Music 未能找到獨立曲目，英文名留空。
- `サラバ`：香港 Apple Music 未能找到獨立曲目，英文名留空。
- `TOWER OF THE SUN` → `tower of the sun (Live in Hanshin Koshien Stadium, 2022.11.05)`：香港 Apple Music 有正式現場音源。

## 平台原樣例子

不要擅自修正以下 Apple Music 顯示方式：

- `炎曜日` → `Firely Tuesday`
- `神秘の領域へ` → `Into the land of Mystery`
- `愛の花` → `ai no hana`
- `リズム64` → `rhythm 64`
- `駅前喫茶ポプラ` → `Coffee Shop Poplar`
- `偽者` → `Fake Me`
- `いちについて` → `On Your Marks`

## 主要資料來源

- あいみょん官方 Discography：`https://www.aimyong.net/discography/`
- 香港 Apple Music あいみょん藝人／曲目目錄（HK storefront）

## 給 Codex 的建議

如果此清單之後要加入「聽歌學日文」網站：

1. 先讀取 `HANDOVER.md` main branch 完整內容。
2. 不要把 Apple Music 英文顯示名當作歌名排序 key；網站現有排序應繼續使用 `Song.titleReading` 的完整平假名。
3. 日文原名應繼續作網站主要顯示名稱；Apple Music 英文名較適合作 metadata、搜尋別名或額外欄位。
4. 如加入 Apple Music link，應優先儲存實際 song URL／catalog ID，不要長期依賴 search URL。
5. 不要因英文名存在而改動現有課文 Markdown 第一行或 `歌名讀音：……` metadata 規則。
