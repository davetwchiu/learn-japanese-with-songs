# 聽歌學日文

把日文歌曲整理成適合初中級學習者的個人學習網站。每首歌都有逐句翻譯、內容情境、文法、生字、口語、易錯位和實用句子，並可選擇加入 YouTube 內嵌播放器。

## 加入新課文

登入後開啟「匯入課文」，可使用以下三種方式：

- 貼上完整文字或 Markdown 學習材料
- 上載 JSON、TXT 或 Markdown 檔案
- 輸入公開課文網址

匯入完成後，歌曲目錄、文法索引和生字索引會自動更新。亦可把符合
`content/songs/_template.json` 格式的 JSON 提交到 GitHub `main` 分支；
網站每次載入時都會自動讀取新檔案。

### Ruby 假名注音

以下兩種寫法都會顯示成日文常見的 ruby 注音：

```text
漢字（かんじ）
[漢字]{かんじ}
```

第二種適合要精確指定注音範圍時使用。

### YouTube 播放器

把 YouTube 網址中 `v=` 後面的影片 ID 放到 `youtubeId`：

```json
"youtubeId": "dQw4w9WgXcQ"
```

如不需要播放器，保留 `null`。

## 本機預覽

```bash
npm install
cp .env.example .dev.vars
npm run dev
```

在 `.dev.vars` 設定至少 12 個字元的 `SITE_PASSWORD`。這個檔案不會提交
到 Git。

## 驗證

```bash
npm test
```

網站使用 vinext，並可部署到 OpenAI Sites。
