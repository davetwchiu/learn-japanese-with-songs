import { requestIsAuthenticated } from "@/app/password-auth";
import { listStoredSongs } from "@/db";

export async function GET(request: Request) {
  if (!(await requestIsAuthenticated(request))) {
    return Response.json({ error: "請先登入。" }, { status: 401 });
  }
  try {
    return Response.json({ songs: await listStoredSongs() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "無法讀取課文。" },
      { status: 500 },
    );
  }
}
