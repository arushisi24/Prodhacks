import { NextRequest, NextResponse } from "next/server";
import { decodeSession, encodeSession, SessionData } from "@/lib/session";

function setCookie(res: NextResponse, data: SessionData) {
  res.cookies.set("session", encodeSession(data), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

// POST { docType, url } — save upload URL to session
export async function POST(req: NextRequest) {
  const session = decodeSession(req.cookies.get("session")?.value);
  let docType: string, url: string;
  try {
    ({ docType, url } = await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!docType || !url)
    return NextResponse.json({ error: "docType and url required" }, { status: 400 });
  if (!session.fields.uploads) session.fields.uploads = {};
  session.fields.uploads[docType] = { url, uploadedAt: new Date().toISOString() };
  const res = NextResponse.json({ ok: true });
  setCookie(res, session);
  return res;
}

// DELETE ?docType=... — remove upload from session
export async function DELETE(req: NextRequest) {
  const session = decodeSession(req.cookies.get("session")?.value);
  const docType = req.nextUrl.searchParams.get("docType");
  if (!docType)
    return NextResponse.json({ error: "docType required" }, { status: 400 });
  if (session.fields.uploads) delete session.fields.uploads[docType];
  const res = NextResponse.json({ ok: true });
  setCookie(res, session);
  return res;
}
