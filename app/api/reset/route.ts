import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SessionData } from "@/lib/session";

export async function POST(req: NextRequest) {
  const empty: SessionData = { messages: [], fields: {} };
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", encodeSession(empty), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
