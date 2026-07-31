# 聽歌學日文

把日文歌曲整理成適合初中級學習者的個人學習網站。每首歌都有逐句翻譯、內容情境、文法、生字、口語、易錯位和實用句子，並可選擇加入 YouTube 內嵌播放器。

## 加入新歌曲

1. 複製 `content/songs/_template.json`。
2. 把檔名和 `slug` 改成相同的小寫英文名稱，例如 `new-song.json` 和 `new-song`。
3. 填入歌曲資料後提交到 GitHub 的 `main` 分支。
4. 回到網站按「掃描新歌曲」。

網站會即時讀取 GitHub 內所有歌曲檔案，並自動更新歌曲目錄、文法索引和生字索引，不必手動改頁面。

### Ruby 假名注音

以下兩種寫法都會顯示成日文常見的 ruby 注音：

```text
雨上がり（あめあがり）
[雨上がり]{あめあがり}
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
npm run dev
```

## 驗證

```bash
npm test
```

網站使用 vinext，並可部署到 OpenAI Sites。
