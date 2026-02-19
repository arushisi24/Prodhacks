import { put } from "@vercel/blob";
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
