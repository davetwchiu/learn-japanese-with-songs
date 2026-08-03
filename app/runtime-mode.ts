import { env } from "cloudflare:workers";

type RuntimeBindings = {
  MIRROR_READ_ONLY?: string;
};

function runtimeBindings(): RuntimeBindings {
  return env as unknown as RuntimeBindings;
}

export function isMirrorReadOnly(): boolean {
  const value =
    runtimeBindings().MIRROR_READ_ONLY ?? process.env.MIRROR_READ_ONLY ?? "";
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function mirrorReadOnlyResponse(): Response | null {
  return isMirrorReadOnly()
    ? Response.json(
        { error: "鏡像網站目前只供閱讀，請到主要網站管理課文。" },
        { status: 403 },
      )
    : null;
}
