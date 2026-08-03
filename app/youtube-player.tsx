"use client";

import { useEffect, useRef, useState } from "react";

const YOUTUBE_API_URL = "https://www.youtube.com/iframe_api";
const PLAYER_PLAYING = 1;
const PLAYER_PAUSED = 2;
const PLAYER_BUFFERING = 3;
const PLAYER_ENDED = 0;
const RESUME_MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface YouTubePlayerInstance {
  getCurrentTime(): number;
  getPlayerState(): number;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayerInstance;
}

interface YouTubePlayerOptions {
  events: {
    onAutoplayBlocked(): void;
    onReady(event: Omit<YouTubePlayerEvent, "data">): void;
    onStateChange(event: YouTubePlayerEvent): void;
  };
}

interface YouTubeApi {
  Player: new (
    element: HTMLIFrameElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface ResumeState {
  savedAt: number;
  time: number;
  videoId: string;
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(
      () => reject(new Error("YouTube player API timed out.")),
      20_000,
    );

    window.onYouTubeIframeAPIReady = () => {
      try {
        previousReady?.();
      } finally {
        window.clearTimeout(timeout);
        if (window.YT?.Player) {
          resolve(window.YT);
        } else {
          reject(new Error("YouTube player API did not initialize."));
        }
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${YOUTUBE_API_URL}"]`,
    );
    if (existing) {
      existing.addEventListener(
        "error",
        () => {
          window.clearTimeout(timeout);
          reject(new Error("YouTube player API failed to load."));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = YOUTUBE_API_URL;
    script.async = true;
    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        reject(new Error("YouTube player API failed to load."));
      },
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

function readResumeState(key: string, videoId: string): ResumeState | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ResumeState>;
    if (
      value.videoId !== videoId ||
      typeof value.time !== "number" ||
      !Number.isFinite(value.time) ||
      typeof value.savedAt !== "number" ||
      Date.now() - value.savedAt > RESUME_MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return value as ResumeState;
  } catch {
    return null;
  }
}

export function YouTubePlayer({
  title,
  videoId,
}: {
  title: string;
  videoId: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const manualResumeRef = useRef<() => void>(() => undefined);
  const [resumePrompt, setResumePrompt] = useState(false);
  const playerSrc = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1`;

  useEffect(() => {
    if (!iframeRef.current) return;

    let active = true;
    let checkTimer: number | undefined;
    let pauseConfirmationTimer: number | undefined;
    const storageKey = `uta-youtube-resume:${videoId}`;
    const lastVisiblePlaying = { current: false };
    const resumeIntent = { current: false };
    const resumeAttempt = { current: false };
    const lastTime = { current: 0 };

    function clearStoredResume() {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // Playback still works when browser storage is unavailable.
      }
    }

    function clearPauseConfirmation() {
      window.clearTimeout(pauseConfirmationTimer);
    }

    function currentPlayerState(): number | null {
      const player = playerRef.current;
      if (!player || typeof player.getPlayerState !== "function") return null;
      try {
        return player.getPlayerState();
      } catch {
        return null;
      }
    }

    function storedOrPendingResume(): ResumeState | null {
      const stored = readResumeState(storageKey, videoId);
      if (stored) return stored;
      if (!resumeIntent.current) return null;
      return { videoId, time: lastTime.current, savedAt: Date.now() };
    }

    function showManualResume() {
      if (!active) return;
      window.clearTimeout(checkTimer);
      resumeAttempt.current = false;
      setResumePrompt(true);
    }

    function confirmPlaying() {
      if (!active) return;
      window.clearTimeout(checkTimer);
      clearPauseConfirmation();
      if (document.visibilityState === "visible") {
        lastVisiblePlaying.current = true;
      }
      resumeIntent.current = false;
      resumeAttempt.current = false;
      setResumePrompt(false);
      clearStoredResume();
    }

    function confirmIntentionalPauseSoon() {
      clearPauseConfirmation();
      pauseConfirmationTimer = window.setTimeout(() => {
        if (!active || document.visibilityState !== "visible") return;
        lastVisiblePlaying.current = false;
        resumeIntent.current = false;
        resumeAttempt.current = false;
        clearStoredResume();
      }, 4_000);
    }

    function verifyResumeSoon() {
      window.clearTimeout(checkTimer);
      checkTimer = window.setTimeout(() => {
        if (!active || !playerRef.current) return;
        if (currentPlayerState() !== PLAYER_PLAYING) {
          showManualResume();
        } else {
          confirmPlaying();
        }
      }, 1_800);
    }

    function tryResume() {
      const player = playerRef.current;
      const saved = storedOrPendingResume();
      if (
        !player ||
        !saved ||
        document.visibilityState !== "visible" ||
        resumeAttempt.current
      ) {
        return;
      }

      resumeIntent.current = true;
      resumeAttempt.current = true;
      lastTime.current = saved.time;
      try {
        if (saved.time > 0) player.seekTo(saved.time, true);
        player.playVideo();
      } catch {
        showManualResume();
        return;
      }
      verifyResumeSoon();
    }

    function rememberPlayback() {
      const player = playerRef.current;
      if (!player) return;
      clearPauseConfirmation();
      const state = currentPlayerState();
      if (
        state !== PLAYER_PLAYING &&
        state !== PLAYER_BUFFERING &&
        !lastVisiblePlaying.current
      ) {
        return;
      }

      const time = player.getCurrentTime();
      resumeIntent.current = true;
      lastTime.current = Number.isFinite(time) ? time : 0;
      try {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            videoId,
            time: lastTime.current,
            savedAt: Date.now(),
          } satisfies ResumeState),
        );
      } catch {
        // The in-memory resume intent still handles this app switch.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        rememberPlayback();
      } else {
        resumeOnReturn();
      }
    }

    function resumeOnReturn() {
      if (
        document.visibilityState !== "visible" ||
        !storedOrPendingResume()
      ) {
        return;
      }
      if (currentPlayerState() === PLAYER_PLAYING) {
        verifyResumeSoon();
        return;
      } else {
        setResumePrompt(true);
      }
      tryResume();
    }

    function onPageShow() {
      resumeOnReturn();
    }

    manualResumeRef.current = () => {
      const player = playerRef.current;
      const saved = storedOrPendingResume();
      if (!player || !saved) return;
      resumeIntent.current = true;
      resumeAttempt.current = true;
      lastTime.current = saved.time;
      try {
        if (saved.time > 0) player.seekTo(saved.time, true);
        player.playVideo();
        setResumePrompt(false);
        verifyResumeSoon();
      } catch {
        showManualResume();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onPageShow);
    window.addEventListener("blur", rememberPlayback);
    window.addEventListener("pagehide", rememberPlayback);
    window.addEventListener("pageshow", onPageShow);

    const iframe = iframeRef.current;
    loadYouTubeApi()
      .then((api) => {
        if (!active) return;
        playerRef.current = new api.Player(iframe, {
          events: {
            onReady(event) {
              playerRef.current = event.target;
              const saved = readResumeState(storageKey, videoId);
              if (saved) {
                resumeIntent.current = true;
                lastTime.current = saved.time;
                resumeOnReturn();
              }
            },
            onStateChange(event) {
              if (!active) return;
              if (event.data === PLAYER_PLAYING) {
                clearPauseConfirmation();
                if (resumeIntent.current || resumeAttempt.current) {
                  verifyResumeSoon();
                } else {
                  confirmPlaying();
                }
              } else if (event.data === PLAYER_ENDED) {
                window.clearTimeout(checkTimer);
                clearPauseConfirmation();
                lastVisiblePlaying.current = false;
                resumeIntent.current = false;
                resumeAttempt.current = false;
                setResumePrompt(false);
                clearStoredResume();
              } else if (
                event.data === PLAYER_PAUSED &&
                document.visibilityState === "visible"
              ) {
                if (resumeIntent.current || resumeAttempt.current) {
                  showManualResume();
                } else {
                  window.clearTimeout(checkTimer);
                  setResumePrompt(false);
                  confirmIntentionalPauseSoon();
                }
              }
            },
            onAutoplayBlocked() {
              showManualResume();
            },
          },
        });
      })
      .catch(() => {
        // Keep the normal embedded player available if the control API fails.
      });

    return () => {
      active = false;
      window.clearTimeout(checkTimer);
      clearPauseConfirmation();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onPageShow);
      window.removeEventListener("blur", rememberPlayback);
      window.removeEventListener("pagehide", rememberPlayback);
      window.removeEventListener("pageshow", onPageShow);
      manualResumeRef.current = () => undefined;
      playerRef.current = null;
    };
  }, [playerSrc, videoId]);

  return (
    <div className="player-stack">
      <div className="player-shell">
        <iframe
          ref={iframeRef}
          src={playerSrc}
          title={`${title} YouTube 播放器`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p className="player-resume-announcement" aria-live="polite">
        {resumePrompt
          ? "影片因切換 App 而暫停，可使用右下角按鈕繼續播放。"
          : ""}
      </p>
      <button
        type="button"
        className="floating-player-resume"
        data-visible={resumePrompt ? "true" : "false"}
        aria-hidden={!resumePrompt}
        aria-label="繼續播放"
        tabIndex={resumePrompt ? 0 : -1}
        onClick={() => manualResumeRef.current()}
      >
        <span className="floating-player-resume-icon" aria-hidden="true" />
      </button>
    </div>
  );
}
