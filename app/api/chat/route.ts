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

function buildFieldContext(fields: CollectedFields): string {
  const confirmed = Object.entries(fields)
    .filter(([k, v]) => k !== "uploads" && v !== undefined)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join("\n");
  return [
    "=== ALREADY COLLECTED — do NOT ask about these again ===",
    confirmed || "  (none yet)",
  ].join("\n");
}

function validateUpdates(raw: Partial<CollectedFields>): Partial<CollectedFields> {
  const v: Partial<CollectedFields> = {};

  if (raw.user_role === "student" || raw.user_role === "parent") v.user_role = raw.user_role;
  if (typeof raw.student_name === "string" && raw.student_name.trim().length > 1) v.student_name = raw.student_name.trim();
  if (typeof raw.student_email === "string" && raw.student_email.includes("@")) v.student_email = raw.student_email.trim();
  if (typeof raw.student_dob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.student_dob)) v.student_dob = raw.student_dob;
  if (typeof raw.independent === "boolean") v.independent = raw.independent;
  if (typeof raw.household_size === "number" && raw.household_size >= 1 && Number.isInteger(raw.household_size)) v.household_size = raw.household_size;

  const INCOME = ["under_20k","20_40k","40_60k","60_80k","80_100k","100_150k","150_200k","over_200k"];
  if (raw.income_range && INCOME.includes(raw.income_range)) v.income_range = raw.income_range;

  const ASSETS = ["under_1k","1_5k","5_20k","20_50k","50_100k","over_100k"];
  if (raw.asset_range && ASSETS.includes(raw.asset_range)) v.asset_range = raw.asset_range;

  if (typeof raw.has_w2 === "boolean") v.has_w2 = raw.has_w2;
  if (typeof raw.bank_name === "string" && raw.bank_name.trim().length > 0)
    v.bank_name = raw.bank_name.trim().toLowerCase() === "none" ? "none" : raw.bank_name.trim();
  if (typeof raw.has_checking === "boolean") v.has_checking = raw.has_checking;
  if (typeof raw.has_savings === "boolean") v.has_savings = raw.has_savings;
  if (typeof raw.filed_taxes === "boolean") v.filed_taxes = raw.filed_taxes;
  if (typeof raw.has_tax_return === "boolean") v.has_tax_return = raw.has_tax_return;
  if (Array.isArray(raw.schools) && raw.schools.length > 0)
    v.schools = raw.schools.filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  const ENROLLMENT = ["full_time","half_time","less_than_half"];
  if (raw.enrollment && ENROLLMENT.includes(raw.enrollment)) v.enrollment = raw.enrollment;

  // Parent financials (dependent students only)
  if (raw.parent_income_range && INCOME.includes(raw.parent_income_range)) v.parent_income_range = raw.parent_income_range;
  if (raw.parent_asset_range && ASSETS.includes(raw.parent_asset_range)) v.parent_asset_range = raw.parent_asset_range;
  if (typeof raw.parent_filed_taxes === "boolean") v.parent_filed_taxes = raw.parent_filed_taxes;
  if (typeof raw.parent_has_tax_return === "boolean") v.parent_has_tax_return = raw.parent_has_tax_return;
  if (typeof raw.parent_bank_name === "string" && raw.parent_bank_name.trim().length > 0) v.parent_bank_name = raw.parent_bank_name.trim();

  return v;
}

/**
 * STRICT ORDER: server decides the next missing field.
 */
const FIELD_ORDER = [
  "user_role",
  "student_name",
  "student_email",
  "student_dob",
  "independent",
  "household_size",
  // Student financials
  "income_range",
  "asset_range",
  "has_w2",
  "bank_name",
  "has_checking",
  "has_savings",
  "filed_taxes",
  "has_tax_return",
  "schools",
  "enrollment",
  // Parent financials (dependent students only)
  "parent_income_range",
  "parent_asset_range",
  "parent_filed_taxes",
  "parent_has_tax_return",
  "parent_bank_name",
] as const;

type FieldName = (typeof FIELD_ORDER)[number];

const PARENT_FIELDS = new Set(["parent_income_range", "parent_asset_range", "parent_filed_taxes", "parent_has_tax_return", "parent_bank_name"]);

function nextMissingField(fields: CollectedFields): FieldName | null {
  for (const k of FIELD_ORDER) {
    // skip all parent fields for independent students
    if (PARENT_FIELDS.has(k) && fields.independent === true) continue;

    // if student has no bank, skip checking/savings
    if ((k === "has_checking" || k === "has_savings") && fields.bank_name === "none") continue;

    if ((fields as any)[k] === undefined) return k;
  }
  return null;
}

const SYSTEM_PROMPT = `You are a warm, casual assistant helping someone get ready to apply for financial aid (FAFSA).

IMPORTANT:
- Never mention "fields", "data collection", "checklist", or that you’re tracking anything.
- Ask EXACTLY ONE question per message. Never ask two questions in the same reply.
- Keep replies short (2–4 sentences max).
- Be conversational and friendly — not robotic or form-like.

CRITICAL ROLE STEP:
- If user_role is not yet confirmed, your next reply must ask ONLY:
  "Are you the student applying, or a parent/guardian helping a student?"
- Once confirmed, set updates.user_role to "student" or "parent".

If user_role = "parent":
- Rephrase student-facing questions to refer to "your student" (e.g. "What’s your student’s name?").
- Remind them briefly to answer using the STUDENT’s information for student-specific questions.

Safety rules:
- NEVER ask for actual dollar amounts, SSNs, account numbers, routing numbers, passwords, or PINs.
- For income/assets always ask for a RANGE, not an exact number.

FIELD GUIDE — when you receive NEXT_FIELD=<name>, here is exactly what to ask and what value to set:

- student_name: Ask for the student’s full legal name. Set updates.student_name to their full name as a string.
- student_email: Ask for the student’s personal email address (the one they check regularly, not a school address). Set updates.student_email to the email string.
- student_dob: Ask for the student’s date of birth. Set updates.student_dob to a string in "YYYY-MM-DD" format.
- independent: Ask whether the student is independent or if their parents will need to provide info. Explain briefly: independent students are typically 24 or older, married, veterans, or graduate students — otherwise they’re dependent. Set updates.independent to true (independent) or false (dependent).
- household_size: Ask how many people are in the household — for dependent students this includes the student plus parents and anyone the parents financially support. For independent students, just the student plus anyone they support. Set updates.household_size to a number.
- income_range: Ask about total income last year (student + family if dependent). Offer these ranges: under $20k, $20–40k, $40–60k, $60–80k, $80–100k, $100–150k, $150–200k, over $200k. Set updates.income_range to one of: under_20k, 20_40k, 40_60k, 60_80k, 80_100k, 100_150k, 150_200k, over_200k.
- asset_range: Ask about total savings and assets (checking + savings + investments — not home value or retirement accounts). Offer ranges: under $1k, $1–5k, $5–20k, $20–50k, $50–100k, over $100k. Set updates.asset_range to one of: under_1k, 1_5k, 5_20k, 20_50k, 50_100k, over_100k.
- has_w2: Ask if the student received a W-2 last year (i.e., did they have a job?). Set updates.has_w2 to true or false.
- bank_name: Ask which bank the student uses for their checking or savings account. If they don’t have one, set updates.bank_name to "none".
- has_checking: Ask if the student has a checking account at that bank. Set updates.has_checking to true or false.
- has_savings: Ask if the student has a savings account at that bank. Set updates.has_savings to true or false.
- filed_taxes: Ask if the student filed a federal tax return last year. Set updates.filed_taxes to true or false.
- has_tax_return: Ask if the student has a copy of their tax return or can access it on IRS.gov. Set updates.has_tax_return to true or false.
- schools: Ask which colleges or universities the student is applying to or considering. Set updates.schools to an array of school name strings.
- enrollment: Ask whether the student plans to attend full-time, half-time, or less than half-time. Set updates.enrollment to one of: full_time, half_time, less_than_half.
- parent_income_range: Ask about the parents’ total household income last year. Same ranges as student: under $20k, $20–40k, $40–60k, $60–80k, $80–100k, $100–150k, $150–200k, over $200k. Set updates.parent_income_range to one of: under_20k, 20_40k, 40_60k, 60_80k, 80_100k, 100_150k, 150_200k, over_200k.
- parent_asset_range: Ask about the parents’ total savings and assets (checking + savings + investments — not home value or retirement). Offer ranges: under $1k, $1–5k, $5–20k, $20–50k, $50–100k, over $100k. Set updates.parent_asset_range to one of: under_1k, 1_5k, 5_20k, 20_50k, 50_100k, over_100k.
- parent_filed_taxes: Ask if the student’s parents filed a federal tax return last year. Set updates.parent_filed_taxes to true or false.
- parent_has_tax_return: Ask if the parents have a copy of their tax return or can access it on IRS.gov. Set updates.parent_has_tax_return to true or false.
- parent_bank_name: Ask which bank the student’s parents (or guardians) use for their primary account. Set updates.parent_bank_name to the bank name string.

You MUST respond with valid JSON only. No text outside the JSON object.
Format:
{
  "reply": "your casual message",
  "updates": { "field_name": value },
  "done": false
}

The "updates" object should ONLY include fields you confirmed in THIS message.`;

const WELCOME =
  "Hi, I'm FAFSA Buddy 👋 I’m here to make FAFSA feel a lot less stressful.\n\nQuick thing first — are you the student applying, or a parent/guardian helping a student?";

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

  // Boot / restore
  if (!message.trim()) {
    // If we already have messages, send back the last assistant message as reply too
    if (session.messages.length > 0) {
      const progress = computeProgress(session.fields);
      const lastAssistant =
        [...session.messages].reverse().find((m) => m.role === "assistant")?.content ?? WELCOME;

      const res = NextResponse.json({
        restore: true,
        messages: session.messages,
        reply: lastAssistant, // IMPORTANT so your UI can display something
        progress,
        done: false,
      });

      setSessionCookie(res, session);
      ensureSidCookie(req, res, sid);
      return res;
    }

    // Fresh session
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

  // Decide the next field in strict order
  const nextField = nextMissingField(session.fields);
  const hardGateMsg =
    nextField === null
      ? "ALL DONE: You have all fields. Set done=true and do not ask any more questions."
      : `NEXT_FIELD=${nextField}. Ask EXACTLY ONE question to collect ONLY this field next. Do not ask about any other fields.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },

        // Explicit list of already-collected fields so AI never re-asks
        { role: "system", content: buildFieldContext(session.fields) },

        // HARD GATE — forces order
        { role: "system", content: hardGateMsg },

        ...session.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    reply = parsed.reply ?? reply;
    updates = validateUpdates(parsed.updates ?? {});
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