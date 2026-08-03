import { env } from "cloudflare:workers";
import { isMirrorReadOnly } from "@/app/runtime-mode";
import { getD1 } from "@/db";
import {
  applyMirrorEvent,
  parseMirrorEvent,
  verifyMirrorSignature,
} from "@/db/mirror";

type ReceiverBindings = {
  MIRROR_SECRET?: string;
};

const MAX_BODY_LENGTH = 4_000_000;
const MAX_SIGNATURE_AGE_SECONDS = 300;

export async function POST(request: Request) {
  if (!isMirrorReadOnly()) {
    return Response.json({ error: "Mirror receiver is disabled." }, { status: 404 });
  }

  const secret = (env as unknown as ReceiverBindings).MIRROR_SECRET ?? "";
  if (secret.length < 32) {
    return Response.json(
      { error: "Mirror receiver is not configured." },
      { status: 503 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_LENGTH) {
    return Response.json({ error: "Mirror event is too large." }, { status: 413 });
  }

  const timestamp = request.headers.get("x-uta-mirror-timestamp") ?? "";
  const signature = request.headers.get("x-uta-mirror-signature") ?? "";
  const eventHeader = request.headers.get("x-uta-mirror-event") ?? "";
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    timestampSeconds > nowSeconds + 60 ||
    nowSeconds - timestampSeconds > MAX_SIGNATURE_AGE_SECONDS
  ) {
    return Response.json({ error: "Mirror signature has expired." }, { status: 401 });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_LENGTH) {
    return Response.json({ error: "Mirror event is too large." }, { status: 413 });
  }
  if (!(await verifyMirrorSignature(secret, timestamp, body, signature))) {
    return Response.json({ error: "Invalid mirror signature." }, { status: 401 });
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid mirror event." }, { status: 400 });
  }
  const event = parseMirrorEvent(value);
  if (!event || event.id !== eventHeader) {
    return Response.json({ error: "Invalid mirror event." }, { status: 400 });
  }

  const result = await applyMirrorEvent(getD1(), event);
  return Response.json({ ok: true, result });
}
