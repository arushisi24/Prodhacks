import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  decodeSession,
  encodeSession,
  computeProgress,
  CollectedFields,
  SessionData,
} from "@/lib/session";

const SYSTEM_PROMPT = `You are a warm, casual assistant helping a college student get ready to apply for financial aid. Your job is to have a friendly conversation while quietly gathering the specific details you need to build them a personalized document checklist at the end.

IMPORTANT: Never mention "fields", "data collection", "checklist", or that you're tracking anything. Just talk naturally like a helpful friend.

Your hidden goal is to collect ALL of these details through conversation:
1. award_year — which school year they're applying for (e.g. 2026-27)
2. independent — are they independent for financial aid purposes? (true/false)
3. household_size — how many people in their household
4. income_range — household income bracket: "under_20k", "20_40k", "40_60k", "60_80k", "80_100k", "100_150k", "150_200k", "over_200k"
5. asset_range — savings/assets bracket: "under_1k", "1_5k", "5_20k", "20_50k", "50_100k", "over_100k"
6. bank_name — the name of their primary bank (e.g. "Chase", "Wells Fargo", "Bank of America")
7. has_checking — do they have a checking account? (true/false)
8. has_savings — do they have a savings account? (true/false)
9. has_w2 — did they receive a W-2 (worked a job last year)? (true/false)
10. filed_taxes — did they (or their parents if dependent) file taxes last year? (true/false)
11. has_tax_return — do they have access to the tax return? (true/false)
12. schools — list of schools they plan to apply to (array of names)
13. enrollment — are they planning full_time, half_time, or less_than_half?
14. parent_bank_name — if dependent, what bank do their parents use?

Strategy:
- Start by asking what's going on with their college plans in a chill, friendly way
- Ask EXACTLY ONE question per message. Never ask two questions in the same reply. Wait for their answer before moving on.
- Weave questions in naturally based on what they say
- If they mention their bank, school, or job — pick up on it and record it
- Use casual language: "sweet", "got it", "nice", "totally", etc.
- Keep replies short (2-4 sentences max) unless explaining something important
- Once you have ALL 14 fields confirmed, set done to true and tell them something like: "That's everything I need! Head over to the Preparations tab on the left — your personalized document list is ready for you there."

Safety rules (strictly enforced):
- NEVER ask for actual dollar amounts, SSNs, account numbers, routing numbers, passwords, or PINs
- If they share any of the above, gently redirect: "No need for the actual numbers — I just need a rough range"
- For income/assets always ask for a range, not a specific number

You MUST respond with valid JSON only. No text outside the JSON object. Format:
{
  "reply": "your casual message to the student",
  "updates": { "field_name": value },
  "done": false
}

The "updates" object should only include fields you confirmed in THIS message (not previously collected ones).
Set "done": true only when you have confirmed ALL 14 fields.`;

const WELCOME = "Hi, I'm FAFSA Buddy 👋 I'm here to make FAFSA feel a lot less stressful.\n\nI can help you apply step-by-step, figure out what you qualify for, and make a checklist of what you need. First, what school year are you applying for?";

function setCookie(res: NextResponse, data: SessionData) {
  res.cookies.set("session", encodeSession(data), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function POST(req: NextRequest) {
  const session = decodeSession(req.cookies.get("session")?.value);
  let message: string;
  try {
    ({ message } = await req.json());
  } catch {
    return NextResponse.json({ reply: "Bad request", progress: 0, done: false }, { status: 400 });
  }

  // Boot welcome
  if (!message.trim()) {
    if (session.messages.length > 0) {
      // Existing session — restore it without wiping
      const progress = computeProgress(session.fields);
      const res = NextResponse.json({
        restore: true,
        messages: session.messages,
        progress,
        done: false,
      });
      setCookie(res, session);
      return res;
    }
    // No session yet — fresh start
    const fresh: SessionData = {
      messages: [{ role: "assistant", content: WELCOME }],
      fields: {},
    };
    const res = NextResponse.json({ reply: WELCOME, progress: 0, done: false });
    setCookie(res, fresh);
    return res;
  }

  session.messages.push({ role: "user", content: message });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let reply: string;
  let updates: Partial<CollectedFields> = {};
  let done = false;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...session.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    reply = parsed.reply ?? "Sorry, I got confused — can you say that again?";
    updates = parsed.updates ?? {};
    done = parsed.done === true;
  } catch (err) {
    console.error("[FAFSA Buddy] OpenAI error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ reply: `Error: ${msg}`, progress: 0, done: false }, { status: 500 });
  }

  session.messages.push({ role: "assistant", content: reply });

  // Merge new fields into session
  session.fields = { ...session.fields, ...updates };

  // Handle schools array — merge rather than overwrite
  if (updates.schools && session.fields.schools) {
    const merged = Array.from(new Set([...session.fields.schools, ...updates.schools]));
    session.fields.schools = merged;
  }

  const progress = computeProgress(session.fields);

  // Safety net: force done if all 14 fields are collected, even if AI forgot to set it
  if (!done && progress >= 1) done = true;

  const res = NextResponse.json({ reply, progress, done });
  setCookie(res, session);
  return res;
}
