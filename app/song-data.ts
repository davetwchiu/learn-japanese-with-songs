import demoSong from "@/content/songs/ameagari.json";

export const GITHUB_REPOSITORY = "davetwchiu/learn-japanese-with-songs";
export const GITHUB_URL = `https://github.com/${GITHUB_REPOSITORY}`;
const CONTENT_API = `https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/content/songs`;
const RAW_ROOT = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/main/content/songs`;
const CACHE_KEY = "uta-nihongo-songs-v1";
const SCANNED_KEY = "uta-nihongo-scanned-v1";

export type Example = { jp: string; zh: string };
export type Grammar = {
  id: string;
  pattern: string;
  meaning: string;
  source: string;
  structure: string;
  explanation: string;
  examples: Example[];
};
export type Vocabulary = {
  id: string;
  term: string;
  reading: string;
  partOfSpeech: string;
  meaning: string;
  note: string;
  exampleJp: string;
  exampleZh: string;
};
export type Song = {
  slug: string;
  title: string;
  titleReading: string;
  artist: string;
  level: string;
  publishedAt: string;
  youtubeId: string | null;
  tags: string[];
  summary: string;
  lyrics: { jp: string; zh: string; note?: string }[];
  context: string[];
  grammar: Grammar[];
  vocabulary: Vocabulary[];
  spoken: {
    term: string;
    kind: string;
    meaning: string;
    tone: string;
    usage: string;
  }[];
  pitfalls: { phrase: string; explanation: string }[];
  phrases: { jp: string; zh: string; when: string }[];
};

export const bundledSongs: Song[] = [demoSong as Song];

function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Partial<Song>;
  return Boolean(
    song.slug &&
      song.title &&
      Array.isArray(song.lyrics) &&
      Array.isArray(song.grammar) &&
      Array.isArray(song.vocabulary),
  );
}

export function mergeSongs(...groups: Song[][]): Song[] {
  const songs = new Map<string, Song>();
  groups.flat().forEach((song) => songs.set(song.slug, song));
  return [...songs.values()].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}

export function loadCachedSongs(): Song[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isSong) : [];
  } catch {
    return [];
  }
}

export function lastScannedAt(): string | null {
  return typeof window === "undefined"
    ? null
    : localStorage.getItem(SCANNED_KEY);
}

export async function scanGithubSongs(): Promise<Song[]> {
  const listing = await fetch(CONTENT_API, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!listing.ok) {
    throw new Error(
      listing.status === 404
        ? "GitHub 歌曲資料庫尚未公開，請稍後再試。"
        : "暫時未能連接 GitHub，請稍後再試。",
    );
  }

  const files = (await listing.json()) as {
    name: string;
    type: string;
    download_url: string | null;
  }[];
  const songs = (
    await Promise.all(
      files
        .filter(
          (file) =>
            file.type === "file" &&
            file.name.endsWith(".json") &&
            !file.name.startsWith("_") &&
            file.download_url,
        )
        .map(async (file) => {
          const response = await fetch(file.download_url!, { cache: "no-store" });
          return response.ok ? ((await response.json()) as unknown) : null;
        }),
    )
  ).filter(isSong);

  localStorage.setItem(CACHE_KEY, JSON.stringify(songs));
  localStorage.setItem(SCANNED_KEY, new Date().toISOString());
  return songs;
}

export async function fetchSong(slug: string): Promise<Song | null> {
  const cached = mergeSongs(bundledSongs, loadCachedSongs()).find(
    (song) => song.slug === slug,
  );
  if (cached) return cached;
  try {
    const response = await fetch(
      `${RAW_ROOT}/${encodeURIComponent(slug)}.json`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const song: unknown = await response.json();
    return isSong(song) ? song : null;
  } catch {
    return null;
  }
}
