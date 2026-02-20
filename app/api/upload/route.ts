import { put, del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const UID_COOKIE = "fb_uid";

function getOrCreateUid(req: NextRequest) {
  const existing = req.cookies.get(UID_COOKIE)?.value;
  return existing || randomUUID();
}

export async function POST(req: NextRequest) {
  const uid = getOrCreateUid(req);
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const docType = (form.get("docType") as string) || "doc";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowed = ["application/pdf", "image/png", "image/jpeg"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF/PNG/JPG allowed" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Max 10MB" }, { status: 400 });
  }

  const key = `fafsa/users/${uid}/${docType}-${Date.now()}-${file.name}`;

  const blob = await put(key, file, { access: "public" });
  const res = NextResponse.json({ url: blob.url });
  // persist uid cookie so uploads keep going into same “folder”
  if (!req.cookies.get(UID_COOKIE)?.value) {
    res.cookies.set(UID_COOKIE, uid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return res;
}

// DELETE /api/upload?url=<blobUrl>
// (deletes the blob object)
export async function DELETE(req: NextRequest) {
  const uid = req.cookies.get(UID_COOKIE)?.value;
  if (!uid) return NextResponse.json({ error: "Missing user session" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  // Basic safety: must be a blob URL
  if (!url.includes("vercel-storage.com")) {
    return NextResponse.json({ error: "Refusing to delete non-blob URL" }, { status: 400 });
  }

  // Strong safety: must be inside THIS user’s “folder”
  const mustInclude = `/fafsa/users/${uid}/`;
  if (!url.includes(mustInclude)) {
    return NextResponse.json({ error: "Refusing to delete outside your folder" }, { status: 400 });
  }

  await del(url);
  return NextResponse.json({ ok: true });
}