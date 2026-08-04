"use client";

import { useEffect, useState, type FormEvent } from "react";
import { lessonMarkdown } from "../../../import-parser";
import { SiteFooter, SiteHeader } from "../../../site-client";
import type { Song } from "../../../song-data";

export function ManageLessonView({ slug }: { slug: string }) {
  const [song, setSong] = useState<Song | null>();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [message, setMessage] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/songs/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          error?: string;
          song?: Song;
        };
        if (!response.ok || !result.song) {
          throw new Error(result.error ?? "找不到課文。");
        }
        setSong(result.song);
        setMarkdown(lessonMarkdown(result.song));
        setYoutubeUrl(
          result.song.youtubeId
            ? `https://youtu.be/${result.song.youtubeId}`
            : "",
        );
      })
      .catch((error: unknown) => {
        setSong(null);
        setMessage(error instanceof Error ? error.message : "找不到課文。");
      });
  }, [slug]);

  async function saveYoutube(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/songs/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      });
      const result = (await response.json()) as {
        error?: string;
        song?: Song;
      };
      if (!response.ok || !result.song) {
        throw new Error(result.error ?? "未能儲存影片。");
      }
      setSong(result.song);
      setMessage(
        result.song.youtubeId ? "YouTube 影片已更新。" : "YouTube 影片已移除。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "未能儲存影片。");
    } finally {
      setStatus("idle");
    }
  }

  async function saveLesson(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/songs/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      const result = (await response.json()) as { error?: string; song?: Song };
      if (!response.ok || !result.song) {
        throw new Error(result.error ?? "未能儲存課文。");
      }
      setSong(result.song);
      setMarkdown(lessonMarkdown(result.song));
      setMessage("課文變更已儲存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "未能儲存課文。");
    } finally {
      setStatus("idle");
    }
  }

  async function deleteLesson() {
    setStatus("deleting");
    setMessage("");
    try {
      const response = await fetch(`/api/songs/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        deleted?: boolean;
        error?: string;
      };
      if (!response.ok || !result.deleted) {
        throw new Error(result.error ?? "未能刪除課文。");
      }
      window.location.assign("/#songs");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "未能刪除課文。");
      setStatus("idle");
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="manage-page">
        <header className="manage-hero">
          <span className="eyebrow">LESSON SETTINGS</span>
          <h1>管理課文</h1>
          <p>{song?.title ?? (song === undefined ? "正在載入⋯⋯" : message)}</p>
          {song && <a href={`/songs/${song.slug}`}>← 返回課文</a>}
        </header>

        {song && (
          <div className="manage-grid">
            <section className="manage-panel lesson-editor-panel">
              <span className="eyebrow">EDIT LESSON</span>
              <h2>修正課文</h2>
              <p>以下顯示原來課文的 Markdown。修改後會重新整理課文內容。</p>
              <form onSubmit={saveLesson}>
                <label>
                  <span>課文 Markdown</span>
                  <textarea
                    value={markdown}
                    onChange={(event) => setMarkdown(event.target.value)}
                    spellCheck={false}
                    rows={24}
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={status !== "idle"}>
                  {status === "saving" ? "儲存中⋯⋯" : "儲存變更"}
                </button>
              </form>
            </section>

            <section className="manage-panel">
              <span className="eyebrow">YOUTUBE PLAYER</span>
              <h2>後補或更換影片</h2>
              <p>貼上 YouTube 網址後，播放器會立即出現在課文頁。</p>
              <form onSubmit={saveYoutube}>
                <label>
                  <span>YouTube 網址</span>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <small>留空再儲存，即可移除現有影片。</small>
                </label>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={status !== "idle"}
                >
                  {status === "saving" ? "儲存中⋯⋯" : "儲存影片 →"}
                </button>
              </form>
            </section>

            <section className="manage-panel danger-panel">
              <span className="eyebrow">DELETE LESSON</span>
              <h2>刪除課文</h2>
              <p>
                刪除後，歌曲目錄、文法索引及生字索引會自動重新整理。
              </p>
              {!confirmingDelete ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                >
                  刪除這篇課文
                </button>
              ) : (
                <div className="delete-confirmation">
                  <strong>確定刪除「{song.title}」？</strong>
                  <p>這個動作不能復原。</p>
                  <div>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={deleteLesson}
                      disabled={status !== "idle"}
                    >
                      {status === "deleting" ? "刪除中⋯⋯" : "確認刪除"}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={status !== "idle"}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {message && song && (
          <p className="manage-message" role="status">
            {message}
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
