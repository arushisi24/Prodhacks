import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { redis } from "@/lib/redis";

const SYSTEM_PROMPT = `You extract financial data from tax documents for FAFSA form completion. Return ONLY valid JSON with these exact fields (use null if not found). All dollar amounts should be integers (no cents, no commas, no dollar signs).

{
  "filing_status": "single" | "head_of_household" | "married_filing_jointly" | "married_filing_separately" | "qualifying_surviving_spouse" | null,
  "income_earned_from_work": number or null,
  "tax_exempt_interest_income": number or null,
  "untaxed_ira_distributions": number or null,
  "ira_rollover": number or null,
  "untaxed_pensions": number or null,
  "pension_rollover": number or null,
  "adjusted_gross_income": number or null,
  "income_tax_paid": number or null,
  "received_eic": true | false | null,
  "ira_deductions_sep_simple": number or null,
  "education_credits": number or null,
  "filed_schedule_a_b_d_e_f_h": true | false | null,
  "schedule_c_net_profit": number or null,
  "college_grants_reported_as_income": number or null,
  "foreign_earned_income_exclusion": number or null,
  "tax_year": number or null,
  "filer_name": string or null,
  "filer_ssn_last4": string or null
}`;

export async function POST(req: NextRequest) {
  try {
    const { blobUrl, fileType, sid } = await req.json();
    const openai = new OpenAI();
    if (!blobUrl || !sid) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const fileRes = await fetch(blobUrl);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const base64 = buffer.toString("base64");

    const isPdf = blobUrl.toLowerCase().includes(".pdf") || fileRes.headers.get("content-type")?.includes("pdf");

    let userContent: any;

    if (isPdf) {
      // Use image_url with PDF mime type — GPT-4o supports this
      userContent = [
        {
          type: "image_url",
          image_url: { url: `data:application/pdf;base64,${base64}` }
        },
        { type: "text", text: `Extract all FAFSA-relevant financial data from this ${fileType || "tax document"}. Return ONLY valid JSON.` }
      ];
    } else {
      const mime = blobUrl.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";
      userContent = [
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        { type: "text", text: `Extract all FAFSA-relevant financial data from this ${fileType || "tax document"}. Return ONLY valid JSON.` }
      ];
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent }
      ],
      max_tokens: 1000,
    });

    const rawResponse = completion.choices[0].message.content ?? "";

    let extracted: any = {};
    try {
      const cleaned = rawResponse.replace(/```json|```/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch (e) {
      // Return the raw response so we can see what GPT said
      return NextResponse.json({ error: "Failed to parse", raw: rawResponse }, { status: 500 });
    }

    const existing: any = (await redis.get(`fafsa:extracted:${sid}`)) || {};
    const merged = { ...existing, ...extracted };
    await redis.set(`fafsa:extracted:${sid}`, merged, { ex: 60 * 60 * 24 * 30 });

    return NextResponse.json({ extracted: merged });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}