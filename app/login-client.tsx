"use client";

import { useState, type FormEvent } from "react";

const OFFLINE_CACHE_PREFIX = "uta-nihongo-offline-";
const LOGIN_TIMEOUT_MS = 15_000;
const OFFLINE_RESET_WAIT_MS = 1_200;

async function resetOfflineShell() {
  const tasks: Promise<unknown>[] = [];
  if ("caches" in window) {
    tasks.push(
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names
              .filter((name) => name.startsWith(OFFLINE_CACHE_PREFIX))
              .map((name) => caches.delete(name)),
          ),
        ),
    );
  }
  if ("serviceWorker" in navigator) {
    tasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.unregister()),
          ),
        ),
    );
  }
  await Promise.allSettled(tasks);
}

async function waitAtMost(promise: Promise<unknown>, milliseconds: number) {
  let timeout: number | undefined;
  await Promise.race([
    promise,
    new Promise<void>((resolve) => {
      timeout = window.setTimeout(resolve, milliseconds);
    }),
  ]);
  if (timeout !== undefined) window.clearTimeout(timeout);
}

export function LoginView() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "密碼不正確。");
      await waitAtMost(resetOfflineShell(), OFFLINE_RESET_WAIT_MS);
      const destination = new URL("/", window.location.origin);
      destination.searchParams.set("signed_in", String(Date.now()));
      window.location.replace(destination.toString());
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "登入連線時間過長，請檢查網絡後再試。"
          : error instanceof Error
            ? error.message
            : "登入失敗。",
      );
    } finally {
      window.clearTimeout(timeout);
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
        <form action="/api/auth/login" method="post" onSubmit={submit}>
          <label htmlFor="site-password">密碼</label>
          <input
            id="site-password"
            name="password"
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
