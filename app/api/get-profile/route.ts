import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const sid = req.cookies.get("fafsa_sid")?.value;
  if (!sid) return NextResponse.json({ error: "No session" }, { status: 404 });

  const fields = await redis.get(`fafsa:fields:${sid}`);
  if (!fields) return NextResponse.json({ error: "No data" }, { status: 404 });

  return NextResponse.json({ fields });
}