"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import {
  bundledSongs,
  fetchSong,
  loadSongLibrary,
  plainSongTitle,
  type Song,
  vocabularySortKey,
} from "./song-data";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { YouTubePlayer } from "./youtube-player";
import { useSiteMode } from "./site-mode-client";

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

  useEffect(() => {
    let active = true;
    loadSongLibrary().then((library) => {
      if (active) setSongs(library);
    });
    return () => {
      active = false;
    };
  }, []);

  return songs;
}

type OfflineStatus = "idle" | "working" | "done" | "error" | "unsupported";

function isAppleMobileDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function messageServiceWorker(
  registration: ServiceWorkerRegistration,
  message: { type: string; urls?: string[]; optionalUrls?: string[] },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!registration.active) {
      reject(new Error("離線功能尚未準備好。"));
      return;
    }
    const channel = new MessageChannel();
    const timeout = window.setTimeout(
      () => reject(new Error("更新時間過長，請再試一次。")),
      60_000,
    );
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      if (event.data?.ok) {
        resolve();
      } else {
        reject(new Error("部分內容未能下載，請再試一次。"));
      }
    };
    registration.active.postMessage(message, [channel.port2]);
  });
}

export function SiteHeader() {
  const { mirrorReadOnly } = useSiteMode();
  const [offlineStatus, setOfflineStatus] =
    useState<OfflineStatus>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!isAppleMobileDevice()) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        );
      if ("caches" in window) {
        caches.keys().then((names) =>
          Promise.all(
            names
              .filter((name) => name.startsWith("uta-nihongo-offline-"))
              .map((name) => caches.delete(name)),
          ),
        );
      }
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => setOfflineStatus("error"));
  }, []);

  async function updateOffline() {
    if (!("serviceWorker" in navigator)) {
      setOfflineStatus("unsupported");
      return;
    }
    setOfflineStatus("working");
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      const response = await fetch("/api/songs", {
        cache: "no-store",
        headers: { "X-Uta-Refresh": "1" },
      });
      if (!response.ok) throw new Error("未能讀取歌曲目錄。");
      const payload = (await response.json()) as {
        songs?: { slug?: unknown }[];
      };
      const slugs = (payload.songs ?? [])
        .map((song) => String(song.slug ?? "").trim())
        .filter(Boolean);
      const loadedAssets = performance
        .getEntriesByType("resource")
        .map((entry) => new URL(entry.name))
        .filter((url) => url.origin === window.location.origin)
        .map((url) => `${url.pathname}${url.search}`);
      const songUrls = slugs.flatMap((slug) => [
        `/songs/${encodeURIComponent(slug)}`,
        `/api/songs/${encodeURIComponent(slug)}`,
      ]);
      await messageServiceWorker(registration, {
        type: "CACHE_URLS",
        urls: [
          "/",
          "/grammar",
          "/vocabulary",
          "/api/songs",
          "/apple-touch-icon.png",
          "/icon-512.png",
          ...songUrls,
        ],
        optionalUrls: loadedAssets,
      });
      setOfflineStatus("done");
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      setOfflineStatus("error");
    }
  }

  async function logout() {
    if ("serviceWorker" in navigator) {
      try {
        await messageServiceWorker(await navigator.serviceWorker.ready, {
          type: "CLEAR_CACHE",
        });
      } catch {
        // Continue signing out even when offline storage cannot be cleared.
      }
    }
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const offlineLabel = {
    idle: "更新",
    working: "更新中…",
    done: "已更新",
    error: "重試",
    unsupported: "不支援",
  }[offlineStatus];

  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="聽歌學日文首頁">
        <span className="brand-mark" aria-hidden="true">
          聴
        </span>
        <span>
          <strong>聽歌學日文</strong>
          <small>UTA × NIHONGO</small>
        </span>
      </a>
      <nav aria-label="主要導覽">
        <a href="/#songs">歌曲目錄</a>
        <a href="/grammar">文法索引</a>
        <a href="/vocabulary">生字索引</a>
        {!mirrorReadOnly && <a href="/import">匯入課文</a>}
        <button
          className="offline-update"
          type="button"
          data-status={offlineStatus}
          onClick={updateOffline}
          disabled={
            offlineStatus === "working" || offlineStatus === "unsupported"
          }
          aria-label="更新離線學習內容"
          aria-live="polite"
          title="下載最新課文，方便離線學習"
        >
          {offlineLabel}
        </button>
        <button type="button" onClick={logout}>
          登出
        </button>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const { mirrorReadOnly } = useSiteMode();
  return (
    <footer className="site-footer">
      <p>
        <strong>聽歌學日文</strong>
        <span>為初中級學習者整理的個人歌曲筆記。</span>
      </p>
      {!mirrorReadOnly && <a href="/import">匯入新課文 →</a>}
    </footer>
  );
}

function SongCard({ song, number }: { song: Song; number: number }) {
  const tags = song.tags.filter((tag) => tag !== "匯入");
  return (
    <a className="song-card" href={`/songs/${song.slug}`}>
      <span className="song-number">{String(number).padStart(2, "0")}</span>
      <div>
        <span className="eyebrow">{song.level}</span>
        <h3>{plainSongTitle(song.title)}</h3>
        <p>{song.artist}</p>
      </div>
      <div className="song-tags">
        {tags.slice(0, 2).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <span className="arrow" aria-hidden="true">
        →
      </span>
    </a>
  );
}

export function HomeView() {
  const songs = useLibrary();
  const { mirrorReadOnly } = useSiteMode();
  const grammarCount = songs.reduce(
    (total, song) => total + song.grammar.length,
    0,
  );
  const vocabularyCount = songs.reduce(
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
              <a className="primary-button" href="#songs">
                開始學習 <span aria-hidden="true">↓</span>
              </a>
              <a className="text-link" href="/grammar">
                瀏覽文法索引 →
              </a>
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
            <strong>{songs.length}</strong>
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
              {songs.map((song, index) => (
                <SongCard key={song.slug} song={song} number={index + 1} />
              ))}
            </div>
            {!mirrorReadOnly && <div className="library-aside">
              <div className="aside-note import-note">
                <span className="eyebrow">加入新課文</span>
                <h3>由你手上的內容直接開始。</h3>
                <p>
                  上載檔案、貼上網址，或直接貼入完整文字。匯入後即可在目錄開啟。
                </p>
                <a href="/import">匯入課文 →</a>
              </div>
            </div>}
          </div>
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
  const { mirrorReadOnly } = useSiteMode();
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
          <p>可以先回到歌曲目錄，或匯入一篇新課文。</p>
          <a className="primary-button" href="/#songs">
            返回歌曲目錄
          </a>
        </main>
        <SiteFooter />
      </>
    );
  }

  const tags = song.tags.filter((tag) => tag !== "匯入");

  return (
    <>
      <SiteHeader />
      <main className="song-page">
        <header className="song-hero">
          <div>
            <span className="eyebrow">
              {song.level}
              {tags.length > 0 ? ` · ${tags.join(" / ")}` : ""}
            </span>
            <h1>{plainSongTitle(song.title)}</h1>
            <p className="song-artist">{song.artist}</p>
            <p className="song-summary">{song.summary}</p>
            {!mirrorReadOnly && (
              <a className="manage-link" href={`/songs/${song.slug}/manage`}>
                管理課文與影片 →
              </a>
            )}
          </div>
          {song.youtubeId ? (
            <YouTubePlayer
              key={song.youtubeId}
              videoId={song.youtubeId}
              title={song.title}
            />
          ) : (
            <div className="player-shell">
              <div className="player-empty">
                <span aria-hidden="true">▶</span>
                <strong>暫未附上影片</strong>
                <p>你仍可先閱讀本課的翻譯和學習重點。</p>
              </div>
            </div>
          )}
        </header>

        <div className="lesson-layout">
          <aside className="lesson-toc">
            <span className="eyebrow">IN THIS LESSON</span>
            <nav aria-label="本課目錄">
              {song.rawText && (
                <a href="#source">
                  <span>00</span>
                  課文內容
                </a>
              )}
              {songSections.map(([id, label], index) => (
                <a href={`#${id}`} key={id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              ))}
            </nav>
            <a className="back-link" href="/#songs">
              ← 返回歌曲目錄
            </a>
          </aside>

          <article className="lesson">
            {song.rawText && (
              <LessonSection id="source" number="00" title="課文內容">
                <div className="raw-lesson">{song.rawText}</div>
              </LessonSection>
            )}
            <LessonSection id="lyrics" number="01" title="逐句日中對照翻譯">
              <div className="lyrics-list">
                {song.lyrics.map((line, index) => (
                  <div className="lyric-pair" key={`${line.jp}-${index}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p className="japanese">
                      <RubyText>{line.jp}</RubyText>
                    </p>
                    <p className="translation">{line.zh}</p>
                    {line.note && (
                      <aside className="lyric-annotation">
                        <strong>段落解讀</strong>
                        {line.note
                          .split(/\n\s*\n/)
                          .map((paragraph, noteIndex) => (
                            <p key={`${index}-${noteIndex}`}>{paragraph}</p>
                          ))}
                      </aside>
                    )}
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
                      <h3>
                        {[item.pattern, item.meaning].filter(Boolean).join("・")}
                      </h3>
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
                    <small>
                      <RubyText>{phrase.when}</RubyText>
                    </small>
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
  const songs = useLibrary();
  const { mirrorReadOnly } = useSiteMode();
  const [query, setQuery] = useState("");
  const isGrammar = kind === "grammar";
  const entries = useMemo(
    () =>
      songs
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
          if ("pattern" in a.item && "pattern" in b.item) {
            return a.item.pattern.localeCompare(b.item.pattern, "ja");
          }
          if ("term" in a.item && "term" in b.item) {
            return (
              vocabularySortKey(a.item).localeCompare(
                vocabularySortKey(b.item),
                "ja",
              ) || a.item.term.localeCompare(b.item.term, "ja")
            );
          }
          return 0;
        }),
    [isGrammar, songs, query],
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
          {!mirrorReadOnly && (
            <a className="index-import-link" href="/import">
              匯入新課文 <span aria-hidden="true">→</span>
            </a>
          )}
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
            <a
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
            </a>
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
