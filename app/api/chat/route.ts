import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { decodeSession, encodeSession, Message } from "@/lib/session";

const SYSTEM_PROMPT = `You are FAFSA Buddy, a friendly and knowledgeable assistant that helps students navigate the FAFSA (Free Application for Federal Student Aid) process.

Your role:
- Guide students step-by-step through what they need to complete FAFSA
- Help them understand dependency status, household size, income/asset ranges
- Estimate Pell Grant eligibility based on their financial situation (using ranges, never exact numbers)
- Provide document checklists and practical tips
- Answer general questions about financial aid and college costs

Pell Grant estimation guidelines (2025-26 / 2026-27, max $7,395):
- Very high need (income under $40k, minimal assets, larger household): $5,900–$7,395 — Very likely
- High need: $4,100–$5,900 — Likely
- Moderate need: $2,600–$4,100 — Possible
- Low need: $1,100–$2,600 — Unlikely/Low
- Over income threshold: likely $0

Safety rules (strictly enforced):
- NEVER ask for SSNs, full account numbers, routing numbers, passwords, or PINs
- If the user shares any of the above, immediately tell them not to share sensitive info and that you can help using ranges instead

Style:
- Be warm, encouraging, and concise
- Use bullet points for lists
- Ask one or two questions at a time — don't overwhelm
- If unsure about something, say so and suggest they confirm with their school's financial aid office`;

const WELCOME =
  "Hi! I'm FAFSA Buddy 👋\n\n" +
  "What do you want help with today?\n" +
  "• Need help paying for college\n" +
  "• Not sure what I qualify for\n" +
  "• School told me to apply\n" +
  "• I don't know\n\n" +
  "Privacy note: don't enter SSNs, bank account/routing numbers, passwords, or PINs.";

function setCookie(res: NextResponse, messages: Message[]) {
  res.cookies.set("session", encodeSession(messages), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function POST(req: NextRequest) {
  const messages = decodeSession(req.cookies.get("session")?.value);
  const { message } = await req.json();

  // Empty message = boot welcome (no AI call needed)
  if (!message.trim()) {
    const welcomeMessages: Message[] = [{ role: "assistant", content: WELCOME }];
    const res = NextResponse.json({ reply: WELCOME, progress: 0, chapter: 1 });
    setCookie(res, welcomeMessages);
    return res;
  }

  messages.push({ role: "user", content: message });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let reply: string;
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    reply = response.choices[0]?.message?.content ?? "Sorry, something went wrong.";
  } catch (err) {
    console.error("[FAFSA Buddy] OpenAI error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ reply: `Error: ${message}`, progress: 0, chapter: 1 }, { status: 500 });
  }

  messages.push({ role: "assistant", content: reply });

  const res = NextResponse.json({ reply, progress: 0, chapter: 1 });
  setCookie(res, messages);
  return res;
}
