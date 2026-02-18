// Cookie-based session — works on Vercel serverless (no in-memory state needed)
// The full UserData is serialized into a signed-ish base64 cookie.
import { UserData, createUserData } from "./core";

export function encodeState(state: UserData): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeState(cookie: string | undefined): UserData {
  if (!cookie) return createUserData();
  try {
    return JSON.parse(Buffer.from(cookie, "base64url").toString("utf-8")) as UserData;
  } catch {
    return createUserData();
  }
}
