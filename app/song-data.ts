const GITHUB_REPOSITORY = "davetwchiu/learn-japanese-with-songs";
const CONTENT_API = `https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/content/songs`;
const RAW_ROOT = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/main/content/songs`;

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
  rawText?: string;
};

export function vocabularySortKey(
  word: Pick<Vocabulary, "term" | "reading">,
): string {
  return (word.reading.trim() || word.term.trim())
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    );
}

export function plainSongTitle(title: string): string {
  return title
    .replace(/\[([^\]]+)\]\{[^}]+\}/gu, "$1")
    .replace(/([\p{Script=Han}々〆ヶ]+)[（(][ぁ-ゖァ-ヺー・]+[）)]/gu, "$1");
}

export function normalizeRubyAnnotations(value: string): string {
  return String(value ?? "").replace(
    /([\p{Script=Han}々〆ヶ]+[ぁ-ゖァ-ヺー]*)[（(]([ぁ-ゖァ-ヺー・]+)[）)]/gu,
    "[$1]{$2}",
  );
}

function normalizeVocabulary(value: unknown): Vocabulary {
  const word = (value ?? {}) as Partial<Vocabulary>;
  return {
    id: String(word.id ?? "").trim(),
    term: String(word.term ?? "").trim(),
    reading: String(word.reading ?? "").trim(),
    partOfSpeech: normalizeRubyAnnotations(
      String(word.partOfSpeech ?? "").trim(),
    ),
    meaning: normalizeRubyAnnotations(String(word.meaning ?? "").trim()),
    note: normalizeRubyAnnotations(String(word.note ?? "").trim()),
    exampleJp: normalizeRubyAnnotations(String(word.exampleJp ?? "").trim()),
    exampleZh: normalizeRubyAnnotations(String(word.exampleZh ?? "").trim()),
  };
}

export function normalizeGrammarHeading(grammar: Grammar): Grammar {
  const item = (grammar ?? {}) as Grammar;
  const pattern = String(item.pattern ?? "").trim();
  const meaning = String(item.meaning ?? "").trim();
  const cleanPattern =
    meaning && pattern.length > meaning.length && pattern.endsWith(meaning)
      ? pattern
          .slice(0, -meaning.length)
          .replace(/[：:・·—–-]+\s*$/u, "")
          .trim()
      : pattern;
  return { ...item, pattern: cleanPattern, meaning };
}

export function normalizeSong(value: unknown): Song {
  const song = (value ?? {}) as Partial<Song>;
  return {
    slug: String(song.slug ?? "").trim(),
    title: String(song.title ?? "").trim(),
    titleReading: String(song.titleReading ?? "").trim(),
    artist: String(song.artist ?? "資料未提供").trim(),
    level: String(song.level ?? "未分類").trim(),
    publishedAt:
      String(song.publishedAt ?? "").trim() ||
      new Date().toISOString().slice(0, 10),
    youtubeId: song.youtubeId ? String(song.youtubeId).trim() : null,
    tags: Array.isArray(song.tags) ? song.tags.map(String).filter(Boolean) : [],
    summary: String(song.summary ?? "").trim(),
    lyrics: Array.isArray(song.lyrics) ? song.lyrics : [],
    context: Array.isArray(song.context) ? song.context.map(String) : [],
    grammar: Array.isArray(song.grammar)
      ? song.grammar.map(normalizeGrammarHeading)
      : [],
    vocabulary: Array.isArray(song.vocabulary)
      ? song.vocabulary.map(normalizeVocabulary)
      : [],
    spoken: Array.isArray(song.spoken) ? song.spoken : [],
    pitfalls: Array.isArray(song.pitfalls) ? song.pitfalls : [],
    phrases: Array.isArray(song.phrases) ? song.phrases : [],
    rawText: song.rawText ? String(song.rawText).trim() : undefined,
  };
}

export function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Partial<Song>;
  return Boolean(
    typeof song.slug === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(song.slug) &&
      typeof song.title === "string" &&
      song.title.trim() &&
      (Array.isArray(song.lyrics) ||
        Array.isArray(song.context) ||
        typeof song.rawText === "string"),
  );
}

export const bundledSongs: Song[] = [];

const existingTitleReadings: Record<string, string> = {
  "会いに行くのに": "あいにいくのに",
  "愛を知るまでは": "あいをしるまでは",
  "葵": "あおい",
  "貴方解剖純愛歌 ～死ね～": "あなたかいぼうじゅんあいか しね",
  "生きていたんだよな": "いきていたんだよな",
  "駅前喫茶ポプラ": "えきまえきっさぽぷら",
  "君の夢を聞きながら、僕は笑えるアイデアを！":
    "きみのゆめをききながらぼくはわらえるあいであを",
  "君はロックを聴かない": "きみはろっくをきかない",
  "猫にジェラシー": "ねこにじぇらしー",
  "ノット・オーケー": "のっと・おーけー",
  "裸の心": "はだかのこころ",
  "ハルノヒ": "はるのひ",
  "ビーナスベルト": "びーなすべると",
  "真夏の夜の匂いがする": "まなつのよるのにおいがする",
  "マリーゴールド": "まりーごーるど",
};

const japaneseCollator = new Intl.Collator("ja", {
  sensitivity: "base",
  numeric: true,
});

export function compareSongsByGojūon(a: Song, b: Song): number {
  const reading = (song: Song) => {
    const annotatedReading = Array.from(
      song.title.matchAll(/\{([^}]+)\}|[（(]([ぁ-ゖァ-ヺー・]+)[）)]/gu),
      (match) => match[1] || match[2],
    ).join("");
    return vocabularySortKey({
      term: song.title,
      reading:
        song.titleReading ||
        annotatedReading ||
        existingTitleReadings[song.title] ||
        song.title,
    });
  };
  return japaneseCollator.compare(reading(a), reading(b));
}

export function mergeSongs(...groups: Song[][]): Song[] {
  const songs = new Map<string, Song>();
  groups.flat().forEach((song) => songs.set(song.slug, song));
  return [...songs.values()].sort(compareSongsByGojūon);
}

async function githubSongs(): Promise<Song[]> {
  const listing = await fetch(CONTENT_API, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!listing.ok) return [];
  const files = (await listing.json()) as {
    name: string;
    type: string;
    download_url: string | null;
  }[];
  const values = await Promise.all(
    files
      .filter(
        (file) =>
          file.type === "file" &&
          file.name.endsWith(".json") &&
          !file.name.startsWith("_") &&
          file.download_url,
      )
      .map(async (file) => {
        try {
          const response = await fetch(file.download_url!, { cache: "no-store" });
          const value: unknown = response.ok ? await response.json() : null;
          return isSong(value) ? normalizeSong(value) : null;
        } catch {
          return null;
        }
      }),
  );
  return values.filter((song): song is Song => Boolean(song));
}

async function storedSongs(): Promise<Song[]> {
  try {
    const response = await fetch("/api/songs", { cache: "no-store" });
    if (!response.ok) return [];
    const payload = (await response.json()) as { songs?: unknown[] };
    return (payload.songs ?? [])
      .filter(isSong)
      .map((song) => normalizeSong(song));
  } catch {
    return [];
  }
}

export async function loadSongLibrary(): Promise<Song[]> {
  const sources = await Promise.allSettled([githubSongs(), storedSongs()]);
  const [github, stored] = sources.map((source) =>
    source.status === "fulfilled" ? source.value : [],
  );
  return mergeSongs(bundledSongs, github, stored);
}

export async function fetchSong(slug: string): Promise<Song | null> {
  const bundled = bundledSongs.find((song) => song.slug === slug);
  if (bundled) return bundled;
  try {
    const stored = await fetch(`/api/songs/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (stored.ok) {
      const payload = (await stored.json()) as { song?: unknown };
      if (isSong(payload.song)) return normalizeSong(payload.song);
    }
    const response = await fetch(
      `${RAW_ROOT}/${encodeURIComponent(slug)}.json`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return isSong(value) ? normalizeSong(value) : null;
  } catch {
    return null;
  }
}
