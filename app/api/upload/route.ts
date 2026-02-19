import { put, del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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

  const blob = await put(`fafsa/${docType}-${Date.now()}-${file.name}`, file, { access: "public" });
  return NextResponse.json({ url: blob.url });
}

// DELETE /api/upload?url=<blobUrl>
// (deletes the blob object)
export async function DELETE(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  if (!url.includes("vercel-storage.com")) {
    return NextResponse.json({ error: "Refusing to delete non-blob URL" }, { status: 400 });
  }

  // If del(url) works for you, keep it.
  // If it fails on Vercel, use explicit token:
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });

  return NextResponse.json({ ok: true });
}