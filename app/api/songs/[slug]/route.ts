import { requestIsAuthenticated } from "@/app/password-auth";
import { findStoredSong } from "@/db";

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
