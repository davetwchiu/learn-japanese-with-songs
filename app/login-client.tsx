"use client";

import { useState, type FormEvent } from "react";

export function LoginView() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "密碼不正確。");
      window.location.reload();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "登入失敗。");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="brand-mark" aria-hidden="true">
          聴
        </span>
        <span className="eyebrow">PRIVATE LIBRARY</span>
        <h1>聽歌學日文</h1>
        <p>輸入網站密碼，繼續你的日文歌曲課堂。</p>
        <form onSubmit={submit}>
          <label htmlFor="site-password">密碼</label>
          <input
            id="site-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "登入中⋯⋯" : "進入網站 →"}
          </button>
        </form>
        {message && (
          <p className="login-error" role="alert">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
