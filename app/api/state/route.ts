import { NextRequest, NextResponse } from "next/server";
import { decodeState } from "@/lib/session";
import { computeProgress } from "@/lib/core";

export async function GET(req: NextRequest) {
  const state = decodeState(req.cookies.get("session")?.value);
  return NextResponse.json({
    mode: state.mode,
    progress: computeProgress(state),
    state,
  });
}
