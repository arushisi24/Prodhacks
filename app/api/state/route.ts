import { NextRequest, NextResponse } from "next/server";
import { decodeSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const messages = decodeSession(req.cookies.get("session")?.value);
  return NextResponse.json({
    message_count: messages.length,
    messages,
  });
}
