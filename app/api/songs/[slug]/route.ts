import { parseImportedLesson, parseYoutubeId } from "@/app/import-parser";
import { requestIsAuthenticated } from "@/app/password-auth";
import {
  deleteStoredSong,
  findStoredSong,
  saveStoredSong,
} from "@/db";
import { mirrorReadOnlyResponse } from "@/app/runtime-mode";
import { dispatchMirrorUpdates } from "@/app/mirror-dispatch";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).origin === new URL(request.url).origin;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await requestIsAuthenticated(request))) {
    return Response.json({ error: "請先登入。" }, { status: 401 });
  }
  const { slug } = await params;
  const song = await findStoredSong(slug);
  return song
    ? Response.json({ song })
    : Response.json({ error: "找不到課文。" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const readOnlyResponse = mirrorReadOnlyResponse();
  if (readOnlyResponse) return readOnlyResponse;
  if (!(await requestIsAuthenticated(request))) {
    return Response.json({ error: "請先登入。" }, { status: 401 });
  }
  if (!sameOrigin(request)) {
    return Response.json({ error: "不接受跨網站修改。" }, { status: 403 });
  }

  try {
    const { slug } = await params;
    const song = await findStoredSong(slug);
    if (!song) {
      return Response.json({ error: "找不到可修改的課文。" }, { status: 404 });
    }
    const payload = (await request.json()) as {
      youtubeUrl?: unknown;
      markdown?: unknown;
    };
    let updated = song;
    if ("youtubeUrl" in payload) {
      if (typeof payload.youtubeUrl !== "string") {
        return Response.json({ error: "影片網址格式不正確。" }, { status: 400 });
      }
      const youtubeUrl = payload.youtubeUrl.trim();
      const youtubeId = youtubeUrl ? parseYoutubeId(youtubeUrl) : null;
      if (youtubeUrl && !youtubeId) {
        return Response.json(
          { error: "請輸入有效的 YouTube 網址。" },
          { status: 400 },
        );
      }
      updated = { ...updated, youtubeId };
    }
    if ("markdown" in payload) {
      if (typeof payload.markdown !== "string") {
        return Response.json({ error: "課文格式不正確。" }, { status: 400 });
      }
      const markdown = payload.markdown.trim();
      const parsed = parseImportedLesson(markdown);
      updated = {
        ...parsed,
        slug: song.slug,
        publishedAt: song.publishedAt,
        youtubeId: updated.youtubeId,
        sourceMarkdown: markdown,
      };
    }
    if (!("youtubeUrl" in payload) && !("markdown" in payload)) {
      return Response.json({ error: "沒有可儲存的變更。" }, { status: 400 });
    }
    await saveStoredSong(updated);
    dispatchMirrorUpdates();
    return Response.json({ song: updated });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "未能更新課文。" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const readOnlyResponse = mirrorReadOnlyResponse();
  if (readOnlyResponse) return readOnlyResponse;
  if (!(await requestIsAuthenticated(request))) {
    return Response.json({ error: "請先登入。" }, { status: 401 });
  }
  if (!sameOrigin(request)) {
    return Response.json({ error: "不接受跨網站刪除。" }, { status: 403 });
  }

  try {
    const { slug } = await params;
    const song = await findStoredSong(slug);
    if (!song) {
      return Response.json({ error: "找不到可刪除的課文。" }, { status: 404 });
    }
    await deleteStoredSong(slug);
    dispatchMirrorUpdates();
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "未能刪除課文。" },
      { status: 500 },
    );
  }
}
