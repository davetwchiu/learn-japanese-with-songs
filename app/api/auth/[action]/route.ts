import {
  authenticatePassword,
  passwordIsConfigured,
  requestIsAuthenticated,
  sessionCookieHeader,
} from "@/app/password-auth";

export async function GET(request: Request) {
  return Response.json(
    {
      authenticated: await requestIsAuthenticated(request),
      configured: await passwordIsConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function nativeLoginFailureResponse(): Response {
  return new Response(
    `<!doctype html><html lang="zh-HK"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>密碼不正確</title><body><main><h1>密碼不正確</h1><p>請返回登入頁再試一次。</p><p><a href="/">返回登入頁</a></p></main></body></html>`,
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
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
  const nativeForm = request.headers
    .get("content-type")
    ?.includes("application/x-www-form-urlencoded");
  const password = nativeForm
    ? String((await request.formData()).get("password") ?? "")
    : String(
        (
          (await request.json().catch(() => ({}))) as {
            password?: unknown;
          }
        ).password ?? "",
      );
  const valid = await authenticatePassword(password);
  const remainingDelay = 300 - (Date.now() - startedAt);
  if (remainingDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  }
  if (!valid) {
    if (nativeForm) return nativeLoginFailureResponse();
    return Response.json({ error: "密碼不正確。" }, { status: 401 });
  }
  const cookie = await sessionCookieHeader();
  if (nativeForm) {
    return new Response(null, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        Location: `/?signed_in=${Date.now()}`,
        "Set-Cookie": cookie,
      },
    });
  }
  return Response.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": cookie,
      },
    },
  );
}
