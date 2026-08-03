import { env, waitUntil } from "cloudflare:workers";
import { deliverMirrorOutbox } from "@/db/mirror";

type MirrorBindings = {
  DB?: D1Database;
  MIRROR_SECRET?: string;
  MIRROR_TARGET_URL?: string;
};

export function dispatchMirrorUpdates(): void {
  const bindings = env as unknown as MirrorBindings;
  if (!bindings.DB || !bindings.MIRROR_SECRET || !bindings.MIRROR_TARGET_URL) {
    return;
  }
  waitUntil(
    deliverMirrorOutbox(
      bindings.DB,
      bindings.MIRROR_TARGET_URL,
      bindings.MIRROR_SECRET,
    ).catch((error) => {
      console.error("Immediate mirror delivery failed", error);
    }),
  );
}
