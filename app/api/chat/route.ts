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

/**
 * STRICT ORDER: server decides the next missing field.
 */
const FIELD_ORDER = [
  "user_role",
  "award_year",
  "independent",
  "household_size",
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
  "parent_bank_name",
] as const;

type FieldName = (typeof FIELD_ORDER)[number];

function nextMissingField(fields: CollectedFields): FieldName | null {
  for (const k of FIELD_ORDER) {
    // don’t ask parent_bank_name if independent
    if (k === "parent_bank_name" && fields.independent === true) continue;

    // if user said no bank, skip checking/savings
    if ((k === "has_checking" || k === "has_savings") && fields.bank_name === "none") continue;

    if ((fields as any)[k] === undefined) return k;
  }
  return null;
}

const SYSTEM_PROMPT = `You are a warm, casual assistant helping someone get ready to apply for financial aid.

IMPORTANT:
- Never mention "fields", "data collection", "checklist", or that you're tracking anything.
- Ask EXACTLY ONE question per message. Never ask two questions in the same reply.
- Keep replies short (2–4 sentences max).

CRITICAL ROLE STEP:
- If user_role is not yet confirmed, your next reply must ask ONLY:
  "Are you the student applying, or a parent/guardian helping a student?"
- Once confirmed, set updates.user_role to "student" or "parent".

If user_role = "parent":
- ALWAYS remind them briefly to answer using the STUDENT’s information (not the parent’s) for student-specific questions.
- Rephrase student-facing questions to refer to "your student".

Safety rules:
- NEVER ask for actual dollar amounts, SSNs, account numbers, routing numbers, passwords, or PINs.
- For income/assets always ask for a RANGE, not a specific number.

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
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },

        // HARD GATE — forces order
        { role: "system", content: hardGateMsg },

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