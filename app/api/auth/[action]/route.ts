import {
  authenticatePassword,
  clearSessionCookieHeader,
  passwordIsConfigured,
  requestIsAuthenticated,
  sessionCookieHeader,
} from "@/app/password-auth";

export async function GET(request: Request) {
  return Response.json({
    authenticated: await requestIsAuthenticated(request),
    configured: await passwordIsConfigured(),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (action === "logout") {
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": clearSessionCookieHeader() } },
    );
  }
  if (action !== "login") {
    return Response.json({ error: "找不到這個操作。" }, { status: 404 });
  }
  if (!(await passwordIsConfigured())) {
    return Response.json(
      { error: "網站密碼尚未設定。" },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const payload = (await request.json().catch(() => ({}))) as {
    password?: string;
  };
  const valid = await authenticatePassword(payload.password ?? "");
  const remainingDelay = 300 - (Date.now() - startedAt);
  if (remainingDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  }
  if (!valid) {
    return Response.json({ error: "密碼不正確。" }, { status: 401 });
  }
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": await sessionCookieHeader() } },
  );
}
