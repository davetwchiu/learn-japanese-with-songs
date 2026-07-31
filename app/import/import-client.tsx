"use client";

import { useState, type FormEvent } from "react";
import { SiteFooter, SiteHeader } from "../site-client";

type Method = "file" | "url" | "paste";

export function ImportView() {
  const [method, setMethod] = useState<Method>("paste");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      if (file && file.size > 1_000_000) {
        throw new Error("課文不可超過 1 MB。");
      }
      const content = method === "file" ? await file?.text() : text;
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: method,
          content,
          fileName: file?.name,
          url,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        song?: { slug: string };
      };
      if (!response.ok || !result.song) {
        throw new Error(result.error ?? "匯入失敗。");
      }
      window.location.assign(`/songs/${result.song.slug}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "匯入失敗。");
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="import-page">
        <header className="import-hero">
          <span className="eyebrow">IMPORT A LESSON</span>
          <h1>匯入課文</h1>
          <p>由檔案、網址或文字內容，加入你的下一課。</p>
        </header>

        <section className="import-panel">
          <div className="import-tabs" role="tablist" aria-label="匯入方法">
            {[
              ["paste", "貼上文字"],
              ["file", "上載檔案"],
              ["url", "貼上網址"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={method === value}
                onClick={() => setMethod(value as Method)}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            {method === "paste" && (
              <label>
                <span>課文內容</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={"# 《歌曲名》日文歌詞學習材料\n\n歌：歌手名稱\n\n## 一、逐句日中對照翻譯\n\n**日文原句**\n中文翻譯"}
                  rows={18}
                  required
                />
              </label>
            )}

            {method === "file" && (
              <label className="file-drop">
                <span>選擇 JSON、TXT 或 Markdown</span>
                <input
                  type="file"
                  accept=".json,.txt,.md,application/json,text/plain,text/markdown"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                />
                <strong>{file?.name ?? "選擇檔案"}</strong>
                <small>每個檔案最多 1 MB</small>
              </label>
            )}

            {method === "url" && (
              <label>
                <span>課文網址</span>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/lesson"
                  required
                />
              </label>
            )}

            <div className="import-note-line">
              <strong>支援完整學習材料</strong>
              <p>
                有「逐句翻譯、文法重點、生字、口語、容易誤解、實用句子」標題的文字會自動拆成相應部分；JSON
                亦會保留完整索引資料。
              </p>
            </div>

            <button
              className="primary-button import-submit"
              type="submit"
              disabled={status === "loading"}
            >
              {status === "loading" ? "匯入中⋯⋯" : "匯入並開啟課文 →"}
            </button>
            {message && (
              <p className="import-error" role="alert">
                {message}
              </p>
            )}
          </form>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
