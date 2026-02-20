import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
  decodeSession,
  encodeSession,
  computeProgress,
  CollectedFields,
  SessionData,
} from "@/lib/session";
import { redis } from "@/lib/redis";
import { randomUUID } from "crypto";

/**
 * Persistent per-user-ish ID (anonymous) so we can store fields in Redis across deployments.
 * This is NOT auth — it’s just a stable identifier stored in an httpOnly cookie.
 */
const SID_COOKIE = "fafsa_sid";

function getOrCreateSid(req: NextRequest) {
  return req.cookies.get(SID_COOKIE)?.value ?? randomUUID();
}

function redisKeyFromSid(sid: string) {
  return `fafsa:fields:${sid}`;
}

async function loadFields(key: string): Promise<CollectedFields> {
  const saved = await redis.get<CollectedFields>(key);
  return saved ?? {};
}

async function saveFields(key: string, fields: CollectedFields) {
  // expire after 7 days (adjust as you want)
  await redis.set(key, fields, { ex: 60 * 60 * 24 * 7 });
}

const SYSTEM_PROMPT = `You are a warm, casual assistant helping a college student get ready to apply for financial aid. Your job is to have a friendly conversation while quietly gathering the specific details you need to build them a personalized document checklist at the end.

IMPORTANT: Never mention "fields", "data collection", "checklist", or that you're tracking anything. Just talk naturally like a helpful friend.

NEW CRITICAL STEP (do this first):
- Before asking about anything else, you MUST determine whether the user is a "student" or a "parent/guardian".
- If user_role is not yet confirmed, your next reply must ask ONLY:
  "Are you the student applying, or a parent/guardian helping a student?"
- Once confirmed, set updates.user_role to "student" or "parent".

If user_role = "parent":
- ALWAYS remind them (briefly) to answer using the STUDENT’s information (not the parent’s) when you ask student-specific questions.
- Example reminder style: "Just a heads up — answer for your student, not you"
- Rephrase every student-facing question to refer to "your student" (e.g., "Is your student applying for 2026–27?").

If user_role = "student":
- Use "you/your" normally.

When user_role="parent", interpret "STUDENT" as "your student" and ask the question accordingly.

Your hidden goal is to collect ALL of these details through conversation:
1. award_year — which school year they're applying for (e.g. 2026-27)
2. independent — are they independent for financial aid purposes? (true/false)
3. household_size — how many people in their household
4. income_range — household income bracket: "under_20k", "20_40k", "40_60k", "60_80k", "80_100k", "100_150k", "150_200k", "150_200k", "over_200k"
5. asset_range — savings/assets bracket: "under_1k", "1_5k", "5_20k", "20_50k", "50_100k", "over_100k"
6. bank_name — the student's OWN primary bank (e.g. "Chase", "Wells Fargo", "Bank of America"). For dependent students, clarify you mean their personal account. If they say they have no bank account, set bank_name to "none" and ALSO set has_checking: false and has_savings: false in the same update — do NOT ask about checking/savings separately.
7. has_checking — does the STUDENT personally have a checking account? (true/false). Skip this if bank_name is "none".
8. has_savings — does the STUDENT personally have a savings account? (true/false). Skip this if bank_name is "none".
9. has_w2 — did the STUDENT receive a W-2 (worked a job last year)? (true/false)
10. filed_taxes — did the PARENTS file taxes last year (for dependent students)? (true/false)
11. has_tax_return — do the PARENTS have access to their tax return? (true/false)
12. schools — list of schools they plan to apply to (array of names)
13. enrollment — are they planning full_time, half_time, or less_than_half?
14. parent_bank_name — if dependent, what bank do their PARENTS use?

IMPORTANT for dependent students: Be explicit about whose info you mean — student vs parents.

Strategy:
- Ask EXACTLY ONE question per message. Never ask two questions in the same reply.
- Keep replies short (2-4 sentences max) unless explaining something important.
- Once you have ALL fields confirmed, set done to true and tell them: "That's everything I need! Head over to the Preparations tab on the left — your personalized document list is ready for you there."

Safety rules:
- NEVER ask for actual dollar amounts, SSNs, account numbers, routing numbers, passwords, or PINs
- For income/assets always ask for a range, not a specific number

You MUST respond with valid JSON only. No text outside the JSON object. Format:
{
  "reply": "your casual message",
  "updates": { "field_name": value },
  "done": false
}

The "updates" object should only include fields you confirmed in THIS message.`;

const WELCOME =
  "Hi, I'm FAFSA Buddy 👋 I’m here to make FAFSA feel a lot less stressful.\n\nQuick thing first — are you the student applying, or a parent/guardian helping a student?";

const FIELD_HINTS: Record<string, string> = {
  user_role: 'one of: "student" | "parent"',
  award_year: 'school year, e.g. "2025-26"',
  independent: "true or false",
  household_size: "a number",
  income_range:
    "one of: under_20k, 20_40k, 40_60k, 60_80k, 80_100k, 100_150k, 150_200k, over_200k",
  asset_range: "one of: under_1k, 1_5k, 5_20k, 20_50k, 50_100k, over_100k",
  bank_name:
    'a bank name like "Chase", "Wells Fargo", "Bank of America", or "none" if no account',
  has_checking: "true or false",
  has_savings: "true or false",
  has_w2: "true or false",
  filed_taxes: "true or false",
  has_tax_return: "true or false",
  schools: 'list of college names, e.g. ["CMU", "Michigan"]',
  enrollment: "one of: full_time, half_time, less_than_half",
  parent_bank_name:
    'a bank name like "Chase", "Wells Fargo", "Bank of America"',
};

function buildFieldContext(fields: CollectedFields): string {
  const ALL_FIELDS = [
    "user_role",
    "award_year",
    "independent",
    "household_size",
    "income_range",
    "asset_range",
    "bank_name",
    "has_checking",
    "has_savings",
    "has_w2",
    "filed_taxes",
    "has_tax_return",
    "schools",
    "enrollment",
    "parent_bank_name",
  ] as const;

  const confirmed = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `  - ${k}: ${JSON.stringify(v)}`)
    .join("\n");

  const needed = ALL_FIELDS
    .filter((k) => {
      if (k === "parent_bank_name" && fields.independent === true) return false;
      return (fields as any)[k] === undefined;
    })
    .map((k) => `  - ${k} (${FIELD_HINTS[k] ?? ""})`)
    .join("\n");

  return [
    "NOTE: If user_role is not set, ask whether they are a student or parent FIRST.",
    "",
    "=== COLLECTED FIELDS (DO NOT ask about these again) ===",
    confirmed || "  (none yet)",
    "",
    "=== STILL NEEDED (interpret the user's next answer as one of these) ===",
    needed || "(all done — set done: true)",
  ].join("\n");
}

function setSessionCookie(res: NextResponse, data: SessionData) {
  res.cookies.set("session", encodeSession(data), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

function ensureSidCookie(req: NextRequest, res: NextResponse, sid: string) {
  if (!req.cookies.get(SID_COOKIE)?.value) {
    res.cookies.set(SID_COOKIE, sid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
}

export async function POST(req: NextRequest) {
  const sid = getOrCreateSid(req);
  const redisKey = redisKeyFromSid(sid);

  const session = decodeSession(req.cookies.get("session")?.value);

  // Load Redis fields and merge into cookie session fields (cookie might have partial data)
  const savedFields = await loadFields(redisKey);
  session.fields = { ...savedFields, ...session.fields };

  let message: string;
  try {
    ({ message } = await req.json());
  } catch {
    return NextResponse.json(
      { reply: "Bad request", progress: 0, done: false },
      { status: 400 }
    );
  }

  // Boot welcome
  if (!message.trim()) {
    if (session.messages.length > 0) {
      const progress = computeProgress(session.fields);
      const res = NextResponse.json({
        restore: true,
        messages: session.messages,
        progress,
        done: false,
      });
      setSessionCookie(res, session);
      ensureSidCookie(req, res, sid);
      return res;
    }

    const fresh: SessionData = {
      messages: [{ role: "assistant", content: WELCOME }],
      fields: {},
    };

    const res = NextResponse.json({ reply: WELCOME, progress: 0, done: false });
    setSessionCookie(res, fresh);
    ensureSidCookie(req, res, sid);
    return res;
  }

  session.messages.push({ role: "user", content: message });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let reply = "Sorry, I got confused — can you say that again?";
  let updates: Partial<CollectedFields> = {};
  let done = false;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: buildFieldContext(session.fields) },
        ...session.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    reply = parsed.reply ?? reply;
    updates = parsed.updates ?? {};
    done = parsed.done === true;
  } catch (err) {
    console.error("[FAFSA Buddy] OpenAI error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { reply: `Error: ${msg}`, progress: 0, done: false },
      { status: 500 }
    );
  }

  session.messages.push({ role: "assistant", content: reply });

  // Merge new fields into session
  session.fields = { ...session.fields, ...updates };

  // Merge schools array instead of overwriting
  if (updates.schools && session.fields.schools) {
    session.fields.schools = Array.from(
      new Set([...(session.fields.schools ?? []), ...(updates.schools ?? [])])
    );
  }

  // If student has no bank account, auto-set checking/savings to false
  if (session.fields.bank_name === "none" || session.fields.bank_name === "") {
    session.fields.has_checking = false;
    session.fields.has_savings = false;
  }

  const progress = computeProgress(session.fields);
  if (!done && progress >= 1) done = true;

  // Persist fields to Redis AFTER updates are merged
  await saveFields(redisKey, session.fields);

  const res = NextResponse.json({ reply, progress: done ? 1 : progress, done });
  setSessionCookie(res, session);
  ensureSidCookie(req, res, sid);
  return res;
}