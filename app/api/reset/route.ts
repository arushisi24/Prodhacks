import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SessionData } from "@/lib/session";
import { redis } from "@/lib/redis";

export async function POST(req: NextRequest) {
  // Clear Redis fields so old data doesn't reload on next boot
  const sid = req.cookies.get("fafsa_sid")?.value;
  if (sid) await redis.del(`fafsa:fields:${sid}`);

  const empty: SessionData = { messages: [], fields: {} };
  const res = NextResponse.json({ ok: true });

  // Clear the session cookie
  res.cookies.set("session", encodeSession(empty), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  // Expire the SID cookie so a fresh SID (and fresh Redis key) is generated next visit
  res.cookies.set("fafsa_sid", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
