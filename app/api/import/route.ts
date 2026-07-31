import { fetchImportUrl, parseImportedLesson } from "@/app/import-parser";
import { requestIsAuthenticated } from "@/app/password-auth";
import { saveStoredSong } from "@/db";

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
    const song = parseImportedLesson(content, sourceName);
    await saveStoredSong(song);
    return Response.json({ song }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "匯入失敗。" },
      { status: 400 },
    );
  }
}
