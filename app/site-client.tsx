"use client";

import {
  bundledSongs,
  fetchSong,
  GITHUB_URL,
  lastScannedAt,
  loadCachedSongs,
  mergeSongs,
  scanGithubSongs,
  type Song,
} from "./song-data";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

const dateFormatter = new Intl.DateTimeFormat("zh-HK", {
  dateStyle: "medium",
  timeStyle: "short",
});

function RubyText({ children }: { children: string }) {
  const pattern =
    /\[([^\]]+)\]\{([^}]+)\}|([\p{Script=Han}々〆ヶ]+[ぁ-ゖァ-ヺー]*)[（(]([ぁ-ゖァ-ヺー・]+)[）)]/gu;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(children))) {
    nodes.push(children.slice(cursor, match.index));
    nodes.push(
      <ruby key={`${match.index}-${match[0]}`}>
        {match[1] ?? match[3]}
        <rt>{match[2] ?? match[4]}</rt>
      </ruby>,
    );
    cursor = pattern.lastIndex;
  }
  nodes.push(children.slice(cursor));
  return <>{nodes}</>;
}

function useLibrary() {
  const [songs, setSongs] = useState<Song[]>(bundledSongs);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanState, setScanState] = useState<
    "idle" | "scanning" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSongs(mergeSongs(bundledSongs, loadCachedSongs()));
      setLastScan(lastScannedAt());
    });
    return () => window.clearTimeout(timer);
  }, []);

  async function scan() {
    setScanState("scanning");
    setMessage("");
    try {
      const remoteSongs = await scanGithubSongs();
      setSongs(mergeSongs(bundledSongs, remoteSongs));
      setLastScan(lastScannedAt());
      setScanState("done");
      setMessage(
        remoteSongs.length
          ? `已同步 ${remoteSongs.length} 首歌曲，目錄與索引已更新。`
          : "掃描完成，暫時未有新歌曲。",
      );
    } catch (error) {
      setScanState("error");
      setMessage(
        error instanceof Error ? error.message : "掃描失敗，請稍後再試。",
      );
    }
  }

  return { songs, lastScan, scanState, message, scan };
}

function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="聽歌學日文首頁">
        <span className="brand-mark" aria-hidden="true">
          聴
        </span>
        <span>
          <strong>聽歌學日文</strong>
          <small>UTA × NIHONGO</small>
        </span>
      </Link>
      <nav aria-label="主要導覽">
        <Link href="/#songs">歌曲目錄</Link>
        <Link href="/grammar">文法索引</Link>
        <Link href="/vocabulary">生字索引</Link>
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        <strong>聽歌學日文</strong>
        <span>為初中級學習者整理的個人歌曲筆記。</span>
      </p>
      <a href={`${GITHUB_URL}/tree/main/content/songs`} target="_blank">
        在 GitHub 管理歌曲 ↗
      </a>
    </footer>
  );
}

function Scanner({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { songs, lastScan, scanState, message, scan } = useLibrary();
  return (
    <div
      className={`scanner ${compact ? "scanner-compact" : ""}`}
      aria-live="polite"
    >
      <div>
        {!compact && <span className="eyebrow">自動整理</span>}
        <strong>{songs.length} 首歌已收錄</strong>
        <small>
          {lastScan
            ? `上次掃描：${dateFormatter.format(new Date(lastScan))}`
            : "按一下即掃描 GitHub 新歌曲"}
        </small>
      </div>
      <button type="button" onClick={scan} disabled={scanState === "scanning"}>
        <span aria-hidden="true">{scanState === "scanning" ? "···" : "↻"}</span>
        {scanState === "scanning" ? "掃描中" : "掃描新歌曲"}
      </button>
      {message && (
        <p className={scanState === "error" ? "error" : "success"}>{message}</p>
      )}
    </div>
  );
}

function SongCard({ song, number }: { song: Song; number: number }) {
  return (
    <Link className="song-card" href={`/songs/${song.slug}`}>
      <span className="song-number">{String(number).padStart(2, "0")}</span>
      <div>
        <span className="eyebrow">{song.level}</span>
        <h3>
          <RubyText>{`${song.title}（${song.titleReading}）`}</RubyText>
        </h3>
        <p>{song.artist}</p>
      </div>
      <div className="song-tags">
        {song.tags.slice(0, 2).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <span className="arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

export function HomeView() {
  const library = useLibrary();
  const grammarCount = library.songs.reduce(
    (total, song) => total + song.grammar.length,
    0,
  );
  const vocabularyCount = library.songs.reduce(
    (total, song) => total + song.vocabulary.length,
    0,
  );

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">SONGS AS TEXTBOOKS</span>
            <h1>
              一邊聽，
              <br />
              一邊讀懂<em>日文。</em>
            </h1>
            <p>
              由逐句翻譯、文法拆解到生字讀音，把每一首喜歡的歌變成一課真正用得着的日文。
            </p>
            <div className="hero-actions">
              <Link className="primary-button" href="#songs">
                開始學習 <span aria-hidden="true">↓</span>
              </Link>
              <Link className="text-link" href="/grammar">
                瀏覽文法索引 →
              </Link>
            </div>
          </div>
          <div className="hero-poster" aria-label="日文歌詞學習示意">
            <span className="poster-kana">うた</span>
            <span className="poster-note" aria-hidden="true">
              ♪
            </span>
            <ruby>
              言葉<rt>ことば</rt>
            </ruby>
            <strong>×</strong>
            <ruby>
              音楽<rt>おんがく</rt>
            </ruby>
            <div className="sound-wave" aria-hidden="true">
              {Array.from({ length: 15 }, (_, index) => (
                <i key={index} />
              ))}
            </div>
            <small>聽見語感・讀懂意思・帶走句型</small>
          </div>
        </section>

        <section className="stat-strip" aria-label="網站內容統計">
          <div>
            <strong>{library.songs.length}</strong>
            <span>歌曲課堂</span>
          </div>
          <div>
            <strong>{grammarCount}</strong>
            <span>文法重點</span>
          </div>
          <div>
            <strong>{vocabularyCount}</strong>
            <span>重點生字</span>
          </div>
          <p>所有漢字讀音均以日文標準 ruby 顯示，手機和電腦都清楚易讀。</p>
        </section>

        <section className="library-section" id="songs">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TABLE OF CONTENTS</span>
              <h2>歌曲目錄</h2>
            </div>
            <p>揀一首歌，由旋律開始理解真正的日文語感。</p>
          </div>

          <div className="library-grid">
            <div className="song-list">
              {library.songs.map((song, index) => (
                <SongCard key={song.slug} song={song} number={index + 1} />
              ))}
            </div>
            <div className="library-aside">
              <Scanner />
              <div className="aside-note">
                <span className="eyebrow">加入新歌</span>
                <h3>新增一個 JSON，索引自動完成。</h3>
                <p>
                  複製歌曲範本、填入內容，再按「掃描新歌曲」。網站會即時重建歌曲目錄、文法和生字連結。
                </p>
                <a href={`${GITHUB_URL}/blob/main/content/songs/_template.json`}>
                  查看歌曲範本 →
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="learning-map">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ONE SONG, EIGHT ANGLES</span>
              <h2>每首歌，八個學習入口</h2>
            </div>
          </div>
          <ol>
            {[
              ["01", "逐句翻譯", "原文與香港中文逐句對照"],
              ["02", "內容情境", "人物、語氣與故事脈絡"],
              ["03", "文法重點", "由原句帶到實用例句"],
              ["04", "生字讀音", "ruby 注音與自然用法"],
              ["05", "口語表達", "縮約、擬聲詞與語感"],
              ["06", "易錯地方", "拆解不能逐字硬譯的句子"],
              ["07", "實用句子", "可真正帶到日常會話"],
              ["08", "YouTube", "一邊播放一邊跟住學"],
            ].map(([number, title, description]) => (
              <li key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

const songSections = [
  ["lyrics", "逐句翻譯"],
  ["context", "內容與情境"],
  ["grammar", "文法重點"],
  ["vocabulary", "生字及讀音"],
  ["spoken", "口語與擬態詞"],
  ["pitfalls", "容易誤解"],
  ["phrases", "實用句子"],
] as const;

export function SongView({ slug }: { slug: string }) {
  const [song, setSong] = useState<Song | null | undefined>(() =>
    bundledSongs.find((item) => item.slug === slug),
  );

  useEffect(() => {
    let active = true;
    fetchSong(slug).then((value) => {
      if (active) setSong(value);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (song === undefined) {
    return (
      <>
        <SiteHeader />
        <main className="state-page">
          <p>正在載入歌曲課堂⋯⋯</p>
        </main>
      </>
    );
  }

  if (!song) {
    return (
      <>
        <SiteHeader />
        <main className="state-page">
          <span className="eyebrow">404 / SONG NOT FOUND</span>
          <h1>暫時搵唔到呢首歌。</h1>
          <p>可以先回到歌曲目錄，再按「掃描新歌曲」同步最新內容。</p>
          <Link className="primary-button" href="/#songs">
            返回歌曲目錄
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="song-page">
        <header className="song-hero">
          <div>
            <span className="eyebrow">
              {song.level} · {song.tags.join(" / ")}
            </span>
            <h1>
              <RubyText>{`${song.title}（${song.titleReading}）`}</RubyText>
            </h1>
            <p className="song-artist">{song.artist}</p>
            <p className="song-summary">{song.summary}</p>
          </div>
          <div className="player-shell">
            {song.youtubeId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}`}
                title={`${song.title} YouTube 播放器`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="player-empty">
                <span aria-hidden="true">▶</span>
                <strong>YouTube 播放器位置</strong>
                <p>在歌曲資料加入 youtubeId 後，影片會自動顯示在這裏。</p>
              </div>
            )}
          </div>
        </header>

        <div className="lesson-layout">
          <aside className="lesson-toc">
            <span className="eyebrow">IN THIS LESSON</span>
            <nav aria-label="本課目錄">
              {songSections.map(([id, label], index) => (
                <a href={`#${id}`} key={id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              ))}
            </nav>
            <Link className="back-link" href="/#songs">
              ← 返回歌曲目錄
            </Link>
          </aside>

          <article className="lesson">
            <LessonSection id="lyrics" number="01" title="逐句日中對照翻譯">
              <div className="lyrics-list">
                {song.lyrics.map((line, index) => (
                  <div className="lyric-pair" key={`${line.jp}-${index}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p className="japanese">
                      <RubyText>{line.jp}</RubyText>
                    </p>
                    <p className="translation">{line.zh}</p>
                    {line.note && <small>{line.note}</small>}
                  </div>
                ))}
              </div>
            </LessonSection>

            <LessonSection id="context" number="02" title="歌曲內容和情境">
              <div className="prose">
                {song.context.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </LessonSection>

            <LessonSection id="grammar" number="03" title="文法重點">
              <div className="grammar-list">
                {song.grammar.map((item) => (
                  <section
                    className="grammar-card"
                    id={`grammar-${item.id}`}
                    key={item.id}
                  >
                    <div className="grammar-title">
                      <h3>{item.pattern}</h3>
                      <span>{item.meaning}</span>
                    </div>
                    <blockquote>
                      <RubyText>{item.source}</RubyText>
                    </blockquote>
                    <dl>
                      <div>
                        <dt>結構</dt>
                        <dd>{item.structure}</dd>
                      </div>
                      <div>
                        <dt>作用</dt>
                        <dd>{item.explanation}</dd>
                      </div>
                    </dl>
                    <div className="examples">
                      <strong>實用例句</strong>
                      {item.examples.map((example) => (
                        <p key={example.jp}>
                          <RubyText>{example.jp}</RubyText>
                          <span>{example.zh}</span>
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </LessonSection>

            <LessonSection id="vocabulary" number="04" title="生字及假名讀音">
              <div className="vocabulary-list">
                {song.vocabulary.map((word) => (
                  <article
                    className="vocabulary-card"
                    id={`word-${word.id}`}
                    key={word.id}
                  >
                    <div>
                      <h3>
                        <ruby>
                          {word.term}
                          <rt>{word.reading}</rt>
                        </ruby>
                      </h3>
                      <span>{word.partOfSpeech}</span>
                    </div>
                    <strong>{word.meaning}</strong>
                    <p>{word.note}</p>
                    <small>
                      <RubyText>{word.exampleJp}</RubyText>
                      <i>{word.exampleZh}</i>
                    </small>
                  </article>
                ))}
              </div>
            </LessonSection>

            <LessonSection id="spoken" number="05" title="擬聲詞、擬態詞及口語">
              <div className="note-grid">
                {song.spoken.map((item) => (
                  <article key={item.term}>
                    <span>{item.kind}</span>
                    <h3>{item.term}</h3>
                    <p>{item.meaning}</p>
                    <p>{item.tone}</p>
                    <small>{item.usage}</small>
                  </article>
                ))}
              </div>
            </LessonSection>

            <LessonSection id="pitfalls" number="06" title="容易誤解的地方">
              <div className="pitfalls">
                {song.pitfalls.map((item, index) => (
                  <article key={item.phrase}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{item.phrase}</h3>
                      <p>{item.explanation}</p>
                    </div>
                  </article>
                ))}
              </div>
            </LessonSection>

            <LessonSection id="phrases" number="07" title="值得背下來的實用句子">
              <div className="phrase-list">
                {song.phrases.map((phrase) => (
                  <article key={phrase.jp}>
                    <p className="japanese">
                      <RubyText>{phrase.jp}</RubyText>
                    </p>
                    <p>{phrase.zh}</p>
                    <small>{phrase.when}</small>
                  </article>
                ))}
              </div>
            </LessonSection>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function LessonSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="lesson-section" id={id}>
      <header>
        <span>{number}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function IndexView({ kind }: { kind: "grammar" | "vocabulary" }) {
  const library = useLibrary();
  const [query, setQuery] = useState("");
  const isGrammar = kind === "grammar";
  const entries = useMemo(
    () =>
      library.songs
        .flatMap((song) =>
          (isGrammar ? song.grammar : song.vocabulary).map((item) => ({
            song,
            item,
          })),
        )
        .filter(({ item }) => {
          const text = isGrammar
            ? `${"pattern" in item ? item.pattern : ""} ${item.meaning}`
            : `${"term" in item ? item.term : ""} ${
                "reading" in item ? item.reading : ""
              } ${item.meaning}`;
          return text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
        })
        .sort((a, b) => {
          const left = "pattern" in a.item ? a.item.pattern : a.item.reading;
          const right = "pattern" in b.item ? b.item.pattern : b.item.reading;
          return left.localeCompare(right, "ja");
        }),
    [isGrammar, library.songs, query],
  );

  return (
    <>
      <SiteHeader />
      <main className="index-page">
        <header className="index-hero">
          <div>
            <span className="eyebrow">
              {isGrammar ? "GRAMMAR INDEX" : "VOCABULARY INDEX"}
            </span>
            <h1>{isGrammar ? "文法索引" : "生字索引"}</h1>
            <p>
              {isGrammar
                ? "跨越所有歌曲尋找句型，直接跳到原句、結構解釋和例句。"
                : "按讀音整理所有重點生字，直接回到歌曲中的實際用法。"}
            </p>
          </div>
          <Scanner compact />
        </header>

        <div className="index-toolbar">
          <label htmlFor="index-search">
            <span>搜尋{isGrammar ? "文法" : "漢字、假名或意思"}</span>
            <input
              id="index-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isGrammar ? "例如：〜ながら" : "例如：雨、あめ、雨後"}
            />
          </label>
          <span>{entries.length} 個項目</span>
        </div>

        <div className="index-list">
          {entries.map(({ song, item }, index) => (
            <Link
              key={`${song.slug}-${item.id}`}
              href={`/songs/${song.slug}#${
                isGrammar ? "grammar" : "word"
              }-${item.id}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>
                  {"pattern" in item ? (
                    item.pattern
                  ) : (
                    <ruby>
                      {item.term}
                      <rt>{item.reading}</rt>
                    </ruby>
                  )}
                </h2>
                <p>{item.meaning}</p>
              </div>
              <div className="index-source">
                <small>收錄於</small>
                <strong>{song.title}</strong>
              </div>
              <i aria-hidden="true">→</i>
            </Link>
          ))}
          {!entries.length && (
            <p className="empty-result">沒有符合「{query}」的項目。</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
