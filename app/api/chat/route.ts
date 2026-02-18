import { NextRequest, NextResponse } from "next/server";
import { decodeState, encodeState } from "@/lib/session";
import { routeMessagePayload } from "@/lib/core";

export async function POST(req: NextRequest) {
  const state = decodeState(req.cookies.get("session")?.value);

  const data = await req.json();
  const message = (data.message || "").trim();

  const payload = routeMessagePayload(state, message);

  const res = NextResponse.json(payload);
  res.cookies.set("session", encodeState(state), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return res;
}
