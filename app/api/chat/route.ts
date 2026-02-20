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
4. income_range — household income bracket: "under_20k", "20_40k", "40_60k", "60_80k", "80_100k", "100_150k", "150_200k", "over_200k"
5. asset_range — savings/assets bracket: "under_1k", "1_5k", "5_20k", "20_50k", "50_100k", "over_100k"
6. bank_name — the student's OWN primary bank (e.g. "Chase", "Wells Fargo", "Bank of America"). For dependent students, clarify you mean their personal account, e.g. "Do you have your own bank account, and if so, which bank?" If they say they have no bank account, set bank_name to "none" and ALSO set has_checking: false and has_savings: false in the same update — do NOT ask about checking/savings separately.
7. has_checking — does the STUDENT personally have a checking account? (true/false). Be explicit: "Do you personally have a checking account?" Skip this question if bank_name is already "none".
8. has_savings — does the STUDENT personally have a savings account? (true/false). Be explicit: "Do you personally have a savings account?" Skip this question if bank_name is already "none".
9. has_w2 — did the STUDENT receive a W-2 (worked a job last year)? (true/false)
10. filed_taxes — did the PARENTS file taxes last year (for dependent students)? (true/false). Be explicit: "Did your parents file taxes last year?"
11. has_tax_return — do the PARENTS have access to their tax return? (true/false). Be explicit: "Do your parents have access to their tax return?"
12. schools — list of schools they plan to apply to (array of names)
13. enrollment — are they planning full_time, half_time, or less_than_half?
14. parent_bank_name — if dependent, what bank do their PARENTS use? Always clarify: "What bank do your parents use?" (this is separate from the student's own bank)

IMPORTANT for dependent students: Financial aid requires BOTH the student's own finances AND the parents' finances. The student may have their own bank account separate from their parents. Always be explicit about whose finances you're asking about — say "your own" when asking about the student, and "your parents'" when asking about the parents.

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

const WELCOME =
  "Hi, I'm FAFSA Buddy 👋 I’m here to make FAFSA feel a lot less stressful.\n\nQuick thing first — are you the student applying, or a parent/guardian helping a student?";

const FIELD_HINTS: Record<string, string> = {
  user_role: 'one of: "student" | "parent"',
  award_year: 'school year, e.g. "2025-26"',
  independent: "true or false",
  household_size: "a number",
  income_range: "one of: under_20k, 20_40k, 40_60k, 60_80k, 80_100k, 100_150k, 150_200k, over_200k",
  asset_range: "one of: under_1k, 1_5k, 5_20k, 20_50k, 50_100k, over_100k",
  bank_name: 'a bank name like "Chase", "Wells Fargo", "Bank of America", or "none" if no account',
  has_checking: "true or false",
  has_savings: "true or false",
  has_w2: "true or false",
  filed_taxes: "true or false",
  has_tax_return: "true or false",
  schools: 'list of college names, e.g. ["CMU", "Michigan"]',
  enrollment: "one of: full_time, half_time, less_than_half",
  parent_bank_name: 'a bank name like "Chase", "Wells Fargo", "Bank of America"',
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
      // don’t ask parent_bank_name if independent
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

  const roleUnknown = session.fields.user_role === undefined;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let reply: string;
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

  // If student has no bank account, auto-set checking/savings to false
  if (session.fields.bank_name === "none" || session.fields.bank_name === "") {
    session.fields.has_checking = false;
    session.fields.has_savings = false;
  }

  const progress = computeProgress(session.fields);

  // Safety net: force done if all fields are collected, even if AI forgot to set it
  if (!done && progress >= 1) done = true;

  const res = NextResponse.json({ reply, progress: done ? 1 : progress, done });
  setCookie(res, session);
  return res;
}
