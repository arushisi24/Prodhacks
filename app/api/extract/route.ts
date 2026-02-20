import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { redis } from "@/lib/redis";

const openai = new OpenAI();

export async function POST(req: NextRequest) {
  const { blobUrl, fileType, sid } = await req.json();
  if (!blobUrl || !sid) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  // Fetch the file from Vercel Blob
  const fileRes = await fetch(blobUrl);
  const buffer = await fileRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  // Ask OpenAI to extract FAFSA fields from the document
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a document parser. Extract FAFSA-relevant financial data from this document. Return ONLY valid JSON with these fields (use null if not found):
{
  "adjusted_gross_income": number or null,
  "income_tax_paid": number or null,
  "wages_salary": number or null,
  "interest_income": number or null,
  "untaxed_ira_distributions": number or null,
  "tax_exempt_interest": number or null,
  "education_credits": number or null,
  "filing_status": "single" | "married" | "head_of_household" | null,
  "employer_name": string or null,
  "tax_year": number or null
}`
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:application/pdf;base64,${base64}` }
          },
          { type: "text", text: `This is a ${fileType || "tax document"}. Extract all FAFSA-relevant financial data.` }
        ]
      }
    ],
    max_tokens: 1000,
  });

  // Parse the extracted data
  let extracted = {};
  try {
    const raw = (completion.choices[0].message.content ?? "")
      .replace(/```json|```/g, "").trim();
    extracted = JSON.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }

  // Save to KV under the user's session
  const existing = await redis.get(`fafsa:extracted:${sid}`) || {};
  const merged = { ...existing, ...extracted };
  await redis.set(`fafsa:extracted:${sid}`, merged, { ex: 60 * 60 * 24 * 30 });

  return NextResponse.json({ extracted: merged });
}