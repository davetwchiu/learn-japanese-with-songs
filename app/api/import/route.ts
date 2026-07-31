import {
  fetchImportUrl,
  parseImportedLesson,
  parseYoutubeId,
} from "@/app/import-parser";
import { requestIsAuthenticated } from "@/app/password-auth";
import {
  deleteStoredSong,
  listStoredSongs,
  saveStoredSong,
} from "@/db";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!(await requestIsAuthenticated(request))) {
    return Response.json({ error: "請先登入。" }, { status: 401 });
  }
  if (!sameOrigin(request)) {
    return Response.json({ error: "不接受跨網站匯入。" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as {
      sourceType?: "file" | "paste" | "url";
      content?: string;
      fileName?: string;
      url?: string;
      youtubeUrl?: string;
    };
    let content = payload.content ?? "";
    let sourceName = payload.fileName ?? "";
    if (payload.sourceType === "url") {
      const imported = await fetchImportUrl(payload.url ?? "");
      content = imported.content;
      sourceName = imported.sourceName;
    }
    if (!["file", "paste", "url"].includes(payload.sourceType ?? "")) {
      return Response.json({ error: "請選擇匯入方法。" }, { status: 400 });
    }
    const importedSong = parseImportedLesson(content, sourceName);
    const suppliedYoutube = payload.youtubeUrl?.trim();
    const videoId = suppliedYoutube ? parseYoutubeId(suppliedYoutube) : null;
    if (suppliedYoutube && !videoId) {
      return Response.json(
        { error: "請輸入有效的 YouTube 網址。" },
        { status: 400 },
      );
    }
    const song = videoId
      ? { ...importedSong, youtubeId: videoId }
      : importedSong;
    await saveStoredSong(song);
    const matchingTitle = (value: string) =>
      value.replaceAll("**", "").trim() === song.title;
    const duplicateSlugs = (await listStoredSongs())
      .filter(
        (stored) =>
          stored.slug !== song.slug && matchingTitle(stored.title),
      )
      .map((stored) => stored.slug);
    await Promise.all(duplicateSlugs.map(deleteStoredSong));
    return Response.json({ song }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "匯入失敗。" },
      { status: 400 },
    );
  }
}
