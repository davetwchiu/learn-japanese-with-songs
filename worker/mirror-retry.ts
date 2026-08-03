import { deliverMirrorOutbox, verifyBearer } from "../db/mirror";

type MirrorRetryBindings = MirrorRetryEnv & {
  MIRROR_SECRET: string;
};

async function drain(env: MirrorRetryBindings) {
  return deliverMirrorOutbox(
    env.DB,
    env.MIRROR_TARGET_URL,
    env.MIRROR_SECRET,
    50,
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    if (
      request.method !== "POST" ||
      url.pathname !== "/run" ||
      !(await verifyBearer(env.MIRROR_SECRET, request.headers.get("authorization")))
    ) {
      return new Response("Not found", { status: 404 });
    }
    return Response.json(await drain(env));
  },

  scheduled(_controller, env, context) {
    context.waitUntil(drain(env));
  },
} satisfies ExportedHandler<MirrorRetryBindings>;
