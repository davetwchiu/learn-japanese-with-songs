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
  return cleanMarkdown(
    text.match(
      new RegExp(`^(?:${escaped.join("|")})\\s*[：:]\\s*(.+)$`, "im"),
    )?.[1]?.trim() ?? "",
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

function cleanMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^---+$/gm, "")
    .trim();
}

type LessonSection =
  | "details"
  | "lyrics"
  | "context"
  | "grammar"
  | "vocabulary"
  | "spoken"
  | "pitfalls"
  | "phrases"
  | "summary";

function sectionName(value: string): LessonSection | null {
  const title = cleanMarkdown(value)
    .replace(
      /^(?:第)?(?:[一二三四五六七八九十百]+|\d+)(?:章|部分)?[、.．:：)\s]+/,
      "",
    )
    .trim();
  if (/^(?:歌曲?|課文)?資料(?:及介紹)?$/.test(title)) return "details";
  if (
    /^(?:逐句.*(?:翻譯|對照)|(?:日中|中日).*對照|歌詞.*翻譯)/.test(title)
  ) {
    return "lyrics";
  }
  if (
    /^(?:歌曲?)?(?:內容|情境|背景|故事|主題).*(?:情境|背景|解讀|分析)?$/.test(
      title,
    )
  ) {
    return "context";
  }
  if (/^(?:日文)?文法(?:重點|解析|分析|學習)?$/.test(title)) {
    return "grammar";
  }
  if (/^(?:生字|詞彙|單字)(?:及|與|和)?.*$/.test(title)) {
    return "vocabulary";
  }
  if (
    /^(?:(?:擬聲詞|擬態詞).*(?:口語|表達|用法)|口語(?:表達|用法|語感)?)$/.test(
      title,
    )
  ) {
    return "spoken";
  }
  if (/^(?:容易誤解|易錯|常見錯誤|翻譯陷阱|注意事項)/.test(title)) {
    return "pitfalls";
  }
  if (/^(?:值得背|實用句|實用表達|常用句)/.test(title)) {
    return "phrases";
  }
  if (/^(?:總結|結語|小結)$/.test(title)) return "summary";
  return null;
}

function lessonSections(text: string): Partial<Record<LessonSection, string>> {
  const headings = [...text.matchAll(/^.{1,80}$/gm)]
    .map((match) => {
      const line = match[0].trim();
      const headingLike =
        /^#{1,6}\s+/.test(line) ||
        /^(?:第)?(?:[一二三四五六七八九十百]+|\d+)(?:章|部分)?[、.．)]\s*/.test(
          line,
        ) ||
        (line.length <= 30 && !/[，。！？：:；;]/.test(line));
      return {
        index: match.index!,
        end: match.index! + match[0].length,
        kind: headingLike ? sectionName(line) : null,
      };
    })
    .filter(
      (
        heading,
      ): heading is { index: number; end: number; kind: LessonSection } =>
        Boolean(heading.kind),
    );
  const sections: Partial<Record<LessonSection, string>> = {};
  headings.forEach((heading, index) => {
    sections[heading.kind] = text
      .slice(heading.end, headings[index + 1]?.index ?? text.length)
      .trim();
  });
  return sections;
}

function pairLine(value: string): string {
  return cleanMarkdown(
    value
      .trim()
      .replace(/^[*+-]\s+/, "")
      .replace(/^(?:日|日文|原文|中|中文|翻譯|譯文)\s*[：:]\s*/i, ""),
  );
}

function looksJapanese(value: string): boolean {
  return /[ぁ-ゖァ-ヺー々〆ヶ]/u.test(value);
}

function scanMarkdownPairs(value: string): {
  pairs: { jp: string; zh: string }[];
  consumed: Set<number>;
} {
  const lines = value.split("\n");
  const pairs: { jp: string; zh: string }[] = [];
  const consumed = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lines[index].trim();
    const marked =
      /\*\*.+\*\*/.test(sourceLine) ||
      /^[*+-]\s+/.test(sourceLine) ||
      /^(?:日|日文|原文)\s*[：:]/i.test(sourceLine);
    const japanese = pairLine(sourceLine);
    if (
      !marked ||
      !japanese ||
      !looksJapanese(japanese) ||
      /^(?:#{1,6}\s|---|\|)/.test(sourceLine)
    ) {
      continue;
    }
    for (let next = index + 1; next < lines.length; next += 1) {
      const translation = lines[next].trim();
      if (!translation) continue;
      if (
        /^(?:#{1,6}\s|---|\|)/.test(translation) ||
        (looksJapanese(pairLine(translation)) &&
          (/\*\*.+\*\*/.test(translation) ||
            /^[*+-]\s+/.test(translation)))
      ) {
        break;
      }
      pairs.push({ jp: japanese, zh: pairLine(translation) });
      consumed.add(index);
      consumed.add(next);
      index = next;
      break;
    }
  }
  return { pairs, consumed };
}

function markdownPairs(value: string): { jp: string; zh: string }[] {
  return scanMarkdownPairs(value).pairs;
}

function lyricNote(value: string): string {
  const note = cleanMarkdown(
    value
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          trimmed &&
          !/^#{1,6}\s+/.test(trimmed) &&
          !/^---+$/.test(trimmed) &&
          !/^\|.+\|$/.test(trimmed)
        );
      })
      .join("\n"),
  );
  if (
    /^(?:第[一二三四五六七八九十\d]+段|副歌|主歌|前奏|間奏|尾聲|verse|chorus)[：:]?$/i.test(
      note,
    )
  ) {
    return "";
  }
  return note;
}

function lyricItems(value: string): Song["lyrics"] {
  const lyrics: Song["lyrics"] = [];
  for (const block of value.split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const { pairs, consumed } = scanMarkdownPairs(block);
    lyrics.push(...pairs);
    const note = lyricNote(
      lines.filter((_, index) => !consumed.has(index)).join("\n"),
    );
    if (note && lyrics.length) {
      const previous = lyrics.at(-1)!;
      previous.note = [previous.note, note].filter(Boolean).join("\n\n");
    }
  }
  return lyrics;
}

function markdownParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .filter((paragraph) => !/^#{1,6}\s+.+\s*$/.test(paragraph.trim()))
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
  const allHeadings = [
    ...value.matchAll(/^(#{2,6})\s+((?:\d+[.)．]\s*)?.+)$/gm),
  ];
  const numbered = allHeadings.filter((heading) =>
    /^\d+[.)．]\s*/.test(heading[2]),
  );
  const headings = numbered.length ? numbered : allHeadings;
  return headings.map((heading, index) => ({
    title: cleanMarkdown(heading[2].replace(/^\d+[.)．]\s*/, "")),
    body: value
      .slice(
        heading.index! + heading[0].length,
        headings[index + 1]?.index ?? value.length,
      )
      .trim(),
  }));
}

function blockAfterLabel(value: string, label: string): string {
  const labelMatch = new RegExp(`^${label}[：:][ \\t]*$`, "im").exec(value);
  if (!labelMatch) return "";
  return value
    .slice(labelMatch.index + labelMatch[0].length)
    .trimStart()
    .split(/\n\s*\n/)[0]
    .trim();
}

function withoutLabeledBlock(value: string, label: string): string {
  const labelMatch = new RegExp(`^${label}[：:][ \\t]*$`, "im").exec(value);
  if (!labelMatch) return value;
  const remaining = value.slice(labelMatch.index + labelMatch[0].length);
  const content = remaining.trimStart();
  const blockLength =
    content.match(/^[\s\S]*?(?=\n\s*\n|$)/)?.[0].length ?? content.length;
  return (
    value.slice(0, labelMatch.index) + content.slice(blockLength)
  ).trim();
}

function grammarItems(value: string): Song["grammar"] {
  return markdownChunks(value).map(({ title, body }) => {
    const examplesPart = body.split(/^例句[：:][ \t]*$/im)[1] ?? "";
    const examples = markdownPairs(examplesPart);
    const labeledSource = blockAfterLabel(body, "歌詞");
    const leadingBlock = body.trimStart().split(/\n\s*\n/)[0].trim();
    const source = (labeledSource || leadingBlock)
      .split("\n")
      .map(pairLine)
      .filter(
        (line) => looksJapanese(line) && !/^(?:歌詞|例句)[：:]?$/.test(line),
      )
      .join("／");
    const structure = cleanMarkdown(blockAfterLabel(body, "結構"));
    let explanationSource = body.split(/^例句[：:][ \t]*$/im)[0];
    if (labeledSource) {
      explanationSource = withoutLabeledBlock(explanationSource, "歌詞");
    } else if (source) {
      explanationSource = explanationSource
        .trimStart()
        .slice(leadingBlock.length)
        .trimStart();
    }
    explanationSource = withoutLabeledBlock(explanationSource, "結構");
    const paragraphs = markdownParagraphs(explanationSource);
    const explanation = paragraphs.join("\n\n") || "詳見歌詞中的實際用法。";
    const inlineMeaning = title.split(/[：:]/).slice(1).join("：").trim();
    const labeledMeaning = field(body, ["意思", "中文意思"]);
    return {
      id: stableSlug(title),
      pattern: title,
      meaning:
        inlineMeaning ||
        labeledMeaning ||
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
  const seen = new Map<string, number>();
  return value
    .split("\n")
    .filter((line) => /^\|.+\|$/.test(line.trim()))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter(
      (cells) =>
        cells.length >= 3 &&
        !/^(?:生字|詞彙|單字|-+)$/.test(cleanMarkdown(cells[0])) &&
        !/^[-:\s]+$/.test(cells.join("")),
    )
    .map(([rawEntry, rawDescription, rawExample]) => {
      const entry = cleanMarkdown(rawEntry);
      const description = cleanMarkdown(rawDescription);
      const example = cleanMarkdown(rawExample);
      const reading = entry.match(/[（(]([^）)]+)[）)]/)?.[1] ?? "";
      const term = entry.replace(/[（(][^）)]+[）)]/, "").trim();
      const [partOfSpeech, meaning] = description
        .split(/[；;]/)
        .map((part) => part.trim());
      const baseId = stableSlug(`${term}-${reading}`);
      const occurrence = (seen.get(baseId) ?? 0) + 1;
      seen.set(baseId, occurrence);
      const exampleParts = looksJapanese(example)
        ? example.match(/^(.+?[。！？])\s*(.+)$/)
        : null;
      return {
        id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
        term,
        reading,
        partOfSpeech: partOfSpeech || "詞語",
        meaning: meaning || description,
        note: looksJapanese(example) ? "" : example,
        exampleJp: exampleParts?.[1] ?? (looksJapanese(example) ? example : ""),
        exampleZh: exampleParts?.[2] ?? "",
      };
    });
}

function rubyMarkup(surface: string, reading: string): string | null {
  const tokens =
    surface.match(/[\p{Script=Han}々〆ヶ]+|[ぁ-ゖァ-ヺー]+/gu) ?? [];
  if (!tokens.length || tokens.join("") !== surface) return null;

  let cursor = 0;
  let markup = "";
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (/^[\p{Script=Han}々〆ヶ]+$/u.test(token)) {
      const next = tokens[index + 1];
      const boundary =
        next && /^[ぁ-ゖァ-ヺー]+$/u.test(next)
          ? reading.indexOf(next, cursor)
          : reading.length;
      if (boundary <= cursor) return null;
      markup += `[${token}]{${reading.slice(cursor, boundary)}}`;
      cursor = boundary;
    } else {
      if (!reading.startsWith(token, cursor)) return null;
      markup += token;
      cursor += token.length;
    }
  }
  return cursor === reading.length ? markup : null;
}

function rubyTargets(vocabulary: Song["vocabulary"]): {
  surface: string;
  markup: string;
  stem: boolean;
}[] {
  const targets = new Map<
    string,
    { surface: string; markup: string; stem: boolean }
  >();
  for (const word of vocabulary) {
    const surface = word.term.trim();
    const reading = word.reading.trim();
    if (!reading || !/[\p{Script=Han}々〆ヶ]/u.test(surface)) continue;

    const fullMarkup = rubyMarkup(surface, reading);
    if (fullMarkup) {
      targets.set(`full:${surface}`, {
        surface,
        markup: fullMarkup,
        stem: false,
      });
    }

    const ending = surface.at(-1) ?? "";
    if (
      /^[うくぐすつぬぶむるい]$/u.test(ending) &&
      reading.endsWith(ending)
    ) {
      const stemSurface = surface.slice(0, -1);
      const stemReading = reading.slice(0, -1);
      const stemMarkup = rubyMarkup(stemSurface, stemReading);
      if (stemMarkup && /[\p{Script=Han}々〆ヶ]/u.test(stemSurface)) {
        targets.set(`stem:${stemSurface}`, {
          surface: stemSurface,
          markup: stemMarkup,
          stem: true,
        });
      }
    }
  }
  return [...targets.values()].sort(
    (left, right) => right.surface.length - left.surface.length,
  );
}

function addRubyToJapanese(
  value: string,
  vocabulary: Song["vocabulary"],
): string {
  if (
    /\[[^\]]+\]\{[^}]+\}|[\p{Script=Han}々〆ヶ]+[（(][ぁ-ゖァ-ヺー・]+[）)]/u.test(
      value,
    )
  ) {
    return value;
  }

  const matches: {
    start: number;
    end: number;
    markup: string;
  }[] = [];
  for (const target of rubyTargets(vocabulary)) {
    const escaped = target.surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(
      `${escaped}${target.stem ? "(?=[ぁ-ゖァ-ヺー])" : ""}`,
      "gu",
    );
    for (const match of value.matchAll(expression)) {
      matches.push({
        start: match.index!,
        end: match.index! + target.surface.length,
        markup: target.markup,
      });
    }
  }

  matches.sort(
    (left, right) =>
      left.start - right.start || right.end - right.start - (left.end - left.start),
  );
  let cursor = 0;
  let result = "";
  for (const match of matches) {
    if (match.start < cursor) continue;
    result += value.slice(cursor, match.start) + match.markup;
    cursor = match.end;
  }
  return result + value.slice(cursor);
}

function addRubyToLyrics(
  lyrics: Song["lyrics"],
  vocabulary: Song["vocabulary"],
): Song["lyrics"] {
  return lyrics.map((line) => ({
    ...line,
    jp: addRubyToJapanese(line.jp, vocabulary),
  }));
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
      [...body.matchAll(/^\s*(?:[*+-]\s+)?\*\*(.+)\*\*\s*$/gm)][0]?.[1]?.trim() ??
      title,
    zh:
      body.match(/^(?:中文|翻譯|譯文)[：:]\s*(.+)$/m)?.[1]?.trim() ?? "",
    when:
      body.match(
        /^(?:(?:適用|使用)?情境|適合場合|用途)[：:]\s*(.+)$/m,
      )?.[1]?.trim() ?? "",
  }));
}

export function parseYoutubeId(value: string): string | null {
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const candidate =
      hostname === "youtu.be"
        ? url.pathname.split("/")[1]
        : hostname === "youtube.com" || hostname.endsWith(".youtube.com")
          ? (url.searchParams.get("v") ??
            url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)?.[1])
          : null;
    return candidate && /^[\w-]{11}$/.test(candidate) ? candidate : null;
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
    const song = normalizeSong(value);
    return {
      ...song,
      lyrics: addRubyToLyrics(song.lyrics, song.vocabulary),
    };
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

  const sections = lessonSections(text);
  const lyricsSection = sections.lyrics ?? "";
  const contextSection = sections.context ?? "";
  const grammarSection = sections.grammar ?? "";
  const vocabularySection = sections.vocabulary ?? "";
  const spokenSection = sections.spoken ?? "";
  const pitfallsSection = sections.pitfalls ?? "";
  const phrasesSection = sections.phrases ?? "";
  const parsedLyrics = lyricItems(lyricsSection);
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
    youtubeId: parseYoutubeId(field(text, ["YouTube", "youtubeId"])),
    tags,
    summary:
      field(text, ["簡介", "摘要", "summary"]) ||
      context[0] ||
      "由匯入內容建立的課文。",
    lyrics: addRubyToLyrics(
      parsedLyrics.length ? parsedLyrics : explicitLyrics,
      vocabulary,
    ),
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
