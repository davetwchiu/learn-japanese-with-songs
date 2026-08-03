"use client";

import { useEffect, useState } from "react";

type BackupState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; songs: unknown[]; json: string };

export function BackupView() {
  const [backup, setBackup] = useState<BackupState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetch("/api/songs", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("未能讀取課文資料。");
        const payload = (await response.json()) as { songs?: unknown[] };
        const songs = Array.isArray(payload.songs) ? payload.songs : [];
        if (active) {
          setBackup({
            status: "ready",
            songs,
            json: JSON.stringify({ songs }, null, 2),
          });
        }
      })
      .catch((error) => {
        if (active) {
          setBackup({
            status: "error",
            message: error instanceof Error ? error.message : "備份失敗。",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function download() {
    if (backup.status !== "ready") return;
    const url = URL.createObjectURL(
      new Blob([backup.json], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "uta-nihongo-songs-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="state-page">
      <span className="eyebrow">TEMPORARY BACKUP</span>
      <h1>課文資料備份</h1>
      {backup.status === "loading" && <p>正在準備備份⋯⋯</p>}
      {backup.status === "error" && <p>{backup.message}</p>}
      {backup.status === "ready" && (
        <>
          <p>已準備 {backup.songs.length} 首課文。</p>
          <button className="primary-button" type="button" onClick={download}>
            下載 JSON 備份
          </button>
          <textarea
            aria-label="課文 JSON 備份"
            readOnly
            value={backup.json}
            rows={8}
            style={{ width: "min(100%, 48rem)" }}
          />
        </>
      )}
    </main>
  );
}
