import { NextRequest, NextResponse } from "next/server";
import { decodeSession, computeProgress } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = decodeSession(req.cookies.get("session")?.value);
  return NextResponse.json({
    fields: session.fields,
    progress: computeProgress(session.fields),
  });
}
