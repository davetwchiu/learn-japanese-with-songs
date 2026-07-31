import { isSong, normalizeSong, type Song } from "./song-data";

const MAX_IMPORT_SIZE = 1_000_000;

function stripCodeFence(value: string): string {
  const match = value.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ?? value;
}

function decodeHtml(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (full, entity: string) => {
      if (entity.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      }
      return entities[entity.toLowerCase()] ?? full;
    },
  );
}

function htmlToText(value: string): string {
  // ponytail: lightweight extraction is enough for readable articles; add a real
  // HTML parser only if imports must preserve complex page structure.
  return decodeHtml(
    value
      .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<(br|\/p|\/div|\/h[1-6]|\/li)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function field(text: string, names: string[]): string {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return (
    text.match(
      new RegExp(`^(?:${escaped.join("|")})\\s*[：:]\\s*(.+)$`, "im"),
    )?.[1]?.trim() ?? ""
  );
}

function stableSlug(title: string): string {
  const ascii = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii) return ascii;
  let hash = 2166136261;
  for (const character of title) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `lesson-${(hash >>> 0).toString(36)}`;
}

function section(
  text: string,
  start: RegExp,
  end: RegExp,
): string {
  const startMatch = start.exec(text);
  if (!startMatch) return "";
  const contentStart = startMatch.index + startMatch[0].length;
  const remaining = text.slice(contentStart);
  const endMatch = end.exec(remaining);
  return remaining.slice(0, endMatch?.index ?? remaining.length).trim();
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^---+$/gm, "")
    .trim();
}

function markdownPairs(value: string): { jp: string; zh: string }[] {
  const lines = value.split("\n");
  const pairs: { jp: string; zh: string }[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const japanese = lines[index].trim().match(/^\*\*(.+)\*\*$/)?.[1]?.trim();
    if (!japanese) continue;
    for (let next = index + 1; next < lines.length; next += 1) {
      const translation = lines[next].trim();
      if (!translation) continue;
      if (
        /^(?:#{1,6}\s|>|---|\*\*)/.test(translation) ||
        /^\|/.test(translation)
      ) {
        break;
      }
      pairs.push({ jp: japanese, zh: cleanMarkdown(translation) });
      index = next;
      break;
    }
  }
  return pairs;
}

function markdownParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map(cleanMarkdown)
    .filter(
      (paragraph) =>
        paragraph &&
        !/^(?:歌詞|結構|例句)[：:]?$/.test(paragraph) &&
        !/^\|/.test(paragraph),
    );
}

function markdownChunks(
  value: string,
): { title: string; body: string }[] {
  const headings = [...value.matchAll(/^###\s+(?:\d+\.\s*)?(.+)$/gm)];
  return headings.map((heading, index) => ({
    title: heading[1].trim(),
    body: value
      .slice(
        heading.index! + heading[0].length,
        headings[index + 1]?.index ?? value.length,
      )
      .trim(),
  }));
}

function grammarItems(value: string): Song["grammar"] {
  return markdownChunks(value).map(({ title, body }) => {
    const examplesPart = body.split(/例句[：:]/i)[1] ?? "";
    const examples = markdownPairs(examplesPart);
    const sourceBlock =
      body.match(/歌詞[：:]\s*((?:\n+\s*\*\*.+\*\*)+)/i)?.[1] ?? "";
    const source = [...sourceBlock.matchAll(/^\s*\*\*(.+)\*\*\s*$/gm)]
      .map((match) => match[1].trim())
      .join("／");
    const structureBlock =
      body.match(/結構[：:]\s*((?:\n+\s*>[^\n]+)+)/i)?.[1] ?? "";
    const structure = structureBlock
      .split("\n")
      .map((line) => line.replace(/^\s*>\s?/, "").trim())
      .filter(Boolean)
      .join("\n");
    const paragraphs = markdownParagraphs(
      body
        .split(/例句[：:]/i)[0]
        .replace(/歌詞[：:]\s*(?:\n+\s*\*\*.+\*\*)+/i, "")
        .replace(/結構[：:]\s*(?:\n+\s*>[^\n]+)+/i, "")
        .replace(/例句[：:][\s\S]*$/i, ""),
    );
    const explanation = paragraphs.join("\n\n") || "詳見歌詞中的實際用法。";
    const inlineMeaning = title.split(/[：:]/).slice(1).join("：").trim();
    return {
      id: stableSlug(title),
      pattern: title,
      meaning:
        inlineMeaning ||
        paragraphs[0]?.split(/[。；\n]/)[0] ||
        "文法及語感重點",
      source,
      structure,
      explanation,
      examples,
    };
  });
}

function vocabularyItems(value: string): Song["vocabulary"] {
  return value
    .split("\n")
    .filter((line) => /^\|.+\|$/.test(line.trim()))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter(
      (cells) =>
        cells.length >= 3 &&
        !/^(?:生字|-+)$/.test(cells[0]) &&
        !/^[-:\s]+$/.test(cells.join("")),
    )
    .map(([entry, description, example]) => {
      const reading = entry.match(/[（(]([^）)]+)[）)]/)?.[1] ?? "";
      const term = entry.replace(/[（(][^）)]+[）)]/, "").trim();
      const [partOfSpeech, meaning] = description
        .split(/[；;]/)
        .map((part) => part.trim());
      return {
        id: stableSlug(`${term}-${reading}`),
        term,
        reading,
        partOfSpeech: partOfSpeech || "詞語",
        meaning: meaning || description,
        note: "",
        exampleJp: example,
        exampleZh: "",
      };
    });
}

function spokenItems(value: string): Song["spoken"] {
  return markdownChunks(value).map(({ title, body }) => {
    const paragraphs = markdownParagraphs(body);
    return {
      term: title,
      kind: "口語／語感",
      meaning: paragraphs[0] ?? "",
      tone: paragraphs.slice(1, -1).join("\n\n"),
      usage: paragraphs.at(-1) ?? "",
    };
  });
}

function pitfallItems(value: string): Song["pitfalls"] {
  return markdownChunks(value).map(({ title, body }) => ({
    phrase: title,
    explanation: markdownParagraphs(body).join("\n\n"),
  }));
}

function phraseItems(value: string): Song["phrases"] {
  return markdownChunks(value).map(({ title, body }) => ({
    jp:
      [...body.matchAll(/^\*\*(.+)\*\*$/gm)][0]?.[1]?.trim() ??
      title.replace(/^\d+\.\s*/, ""),
    zh: body.match(/^中文[：:]\s*(.+)$/m)?.[1]?.trim() ?? "",
    when: body.match(/^情境[：:]\s*(.+)$/m)?.[1]?.trim() ?? "",
  }));
}

function youtubeId(value: string): string | null {
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
    return (
      url.searchParams.get("v") ??
      url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)?.[1] ??
      null
    );
  } catch {
    return null;
  }
}

function lyricPairs(text: string): { jp: string; zh: string }[] {
  const pairs: { jp: string; zh: string }[] = [];
  let japanese = "";
  for (const line of text.split("\n")) {
    const jp = line.match(/^(?:日|日文|原文)\s*[：:]\s*(.+)$/i)?.[1]?.trim();
    const zh = line.match(/^(?:中|中文|翻譯|譯文)\s*[：:]\s*(.+)$/i)?.[1]?.trim();
    if (jp) japanese = jp;
    if (zh && japanese) {
      pairs.push({ jp: japanese, zh });
      japanese = "";
    }
  }
  return pairs;
}

export function parseImportedLesson(
  input: string,
  sourceName = "",
): Song {
  if (!input.trim()) throw new Error("匯入內容不可留空。");
  if (input.length > MAX_IMPORT_SIZE) throw new Error("課文不可超過 1 MB。");

  const unfenced = stripCodeFence(input);
  try {
    const value: unknown = JSON.parse(unfenced);
    if (!isSong(value)) {
      throw new Error("JSON 缺少歌曲名稱、slug 或課文內容。");
    }
    return normalizeSong(value);
  } catch (error) {
    if (
      unfenced.trimStart().startsWith("{") ||
      unfenced.trimStart().startsWith("[")
    ) {
      throw error instanceof Error ? error : new Error("JSON 格式不正確。");
    }
  }

  const text = /<([a-z][\w-]*)\b[^>]*>/i.test(unfenced)
    ? htmlToText(unfenced)
    : unfenced.trim();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const headingTitle = lines[0]?.match(/《([^》]+)》/)?.[1];
  const title =
    field(text, ["標題", "歌名", "title"]) ||
    headingTitle ||
    lines[0]?.replace(/^#+\s*/, "").replace(/日文歌詞學習材料.*$/, "").trim() ||
    sourceName.replace(/\.[^.]+$/, "") ||
    "未命名課文";
  const suppliedSlug = field(text, ["slug"]);
  const tags = field(text, ["標籤", "tags"])
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const lyricsSection = section(
    text,
    /^##\s+(?:一|1)[、.．]\s*逐句[^\n]*$/m,
    /^##\s+(?:二|2)[、.．]/m,
  );
  const contextSection = section(
    text,
    /^##\s+(?:二|2)[、.．]\s*[^\n]+$/m,
    /^##\s+(?:三|3)[、.．]/m,
  );
  const grammarSection = section(
    text,
    /^##\s+(?:三|3)[、.．]\s*[^\n]+$/m,
    /^##\s+(?:四|4)[、.．]/m,
  );
  const vocabularySection = section(
    text,
    /^##\s+(?:四|4)[、.．]\s*[^\n]+$/m,
    /^##\s+(?:五|5)[、.．]/m,
  );
  const spokenSection = section(
    text,
    /^##\s+(?:五|5)[、.．]\s*[^\n]+$/m,
    /^##\s+(?:六|6)[、.．]/m,
  );
  const pitfallsSection = section(
    text,
    /^##\s+(?:六|6)[、.．]\s*[^\n]+$/m,
    /^##\s+(?:七|7)[、.．]/m,
  );
  const phrasesSection = section(
    text,
    /^##\s+(?:七|7)[、.．]\s*[^\n]+$/m,
    /$(?![\s\S])/,
  );
  const parsedLyrics = markdownPairs(lyricsSection);
  const explicitLyrics = lyricPairs(text);
  const context = markdownParagraphs(contextSection);
  const grammar = grammarItems(grammarSection);
  const vocabulary = vocabularyItems(vocabularySection);
  const spoken = spokenItems(spokenSection);
  const pitfalls = pitfallItems(pitfallsSection);
  const phrases = phraseItems(phrasesSection);
  const hasStructuredContent =
    parsedLyrics.length +
      explicitLyrics.length +
      context.length +
      grammar.length +
      vocabulary.length +
      spoken.length +
      pitfalls.length +
      phrases.length >
    0;

  return normalizeSong({
    slug: suppliedSlug || stableSlug(title),
    title,
    titleReading: field(text, ["讀音", "假名", "reading"]),
    artist:
      field(text, ["歌", "歌手", "作者", "artist"]) || "匯入課文",
    level: field(text, ["程度", "級別", "level"]) || "未分類",
    publishedAt: new Date().toISOString().slice(0, 10),
    youtubeId: youtubeId(field(text, ["YouTube", "youtubeId"])),
    tags: tags.length ? tags : ["匯入"],
    summary:
      field(text, ["簡介", "摘要", "summary"]) ||
      context[0] ||
      "由匯入內容建立的課文。",
    lyrics: parsedLyrics.length ? parsedLyrics : explicitLyrics,
    context,
    grammar,
    vocabulary,
    spoken,
    pitfalls,
    phrases,
    rawText: hasStructuredContent ? undefined : text,
  });
}

function blockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  ) {
    return true;
  }
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

export async function fetchImportUrl(
  input: string,
  redirects = 0,
): Promise<{ content: string; sourceName: string }> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("請輸入有效網址。");
  }
  if (!["http:", "https:"].includes(url.protocol) || blockedHostname(url.hostname)) {
    throw new Error("這個網址不受支援。");
  }
  if (redirects > 3) throw new Error("網址重新導向次數太多。");

  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "UtaNihongoImporter/1.0" },
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error("網址重新導向無效。");
    return fetchImportUrl(new URL(location, url).toString(), redirects + 1);
  }
  if (!response.ok) throw new Error(`無法讀取網址（${response.status}）。`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_IMPORT_SIZE) throw new Error("課文不可超過 1 MB。");
  const type = response.headers.get("content-type") ?? "";
  if (/pdf|octet-stream|image|audio|video/i.test(type)) {
    throw new Error("網址需指向 JSON、純文字、Markdown 或網頁。");
  }
  const content = await response.text();
  if (content.length > MAX_IMPORT_SIZE) throw new Error("課文不可超過 1 MB。");
  return {
    content,
    sourceName: url.pathname.split("/").pop() || url.hostname,
  };
}
