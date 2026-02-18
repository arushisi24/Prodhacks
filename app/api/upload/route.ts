import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const docType = (form.get("docType") as string) || "doc";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const blob = await put(`fafsa/${docType}-${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
