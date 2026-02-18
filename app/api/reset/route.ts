import { NextRequest, NextResponse } from "next/server";
import { encodeState } from "@/lib/session";
import { createUserData } from "@/lib/core";

export async function POST(req: NextRequest) {
  const fresh = createUserData();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", encodeState(fresh), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
