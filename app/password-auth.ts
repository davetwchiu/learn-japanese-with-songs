import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

const COOKIE_NAME = "uta_session";
const SESSION_MESSAGE = "uta-nihongo-session-v1";
const encoder = new TextEncoder();

function password(): string {
  return (
    (env as unknown as { SITE_PASSWORD?: string }).SITE_PASSWORD ??
    process.env.SITE_PASSWORD ??
    ""
  );
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function sessionToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(SESSION_MESSAGE)),
    ),
  );
}

export async function passwordIsConfigured(): Promise<boolean> {
  return password().length >= 12;
}

export async function authenticatePassword(input: string): Promise<boolean> {
  const expected = password();
  if (expected.length < 12 || !input) return false;
  return equal(await digest(input), await digest(expected));
}

export async function isSessionTokenValid(
  token: string | undefined,
): Promise<boolean> {
  const secret = password();
  if (!token || secret.length < 12) return false;
  return equal(await digest(token), await digest(await sessionToken(secret)));
}

export async function isPasswordAuthenticated(): Promise<boolean> {
  return isSessionTokenValid((await cookies()).get(COOKIE_NAME)?.value);
}

export async function requestIsAuthenticated(request: Request): Promise<boolean> {
  const match = request.headers
    .get("cookie")
    ?.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return isSessionTokenValid(match?.[1]);
}

export async function sessionCookieHeader(): Promise<string> {
  return `${COOKIE_NAME}=${await sessionToken(password())}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}
