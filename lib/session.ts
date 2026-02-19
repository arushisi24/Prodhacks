export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface CollectedFields {
  award_year?: string;
  independent?: boolean;
  household_size?: number;
  income_range?: string;
  asset_range?: string;
  bank_name?: string;
  has_checking?: boolean;
  has_savings?: boolean;
  has_w2?: boolean;
  filed_taxes?: boolean;
  has_tax_return?: boolean;
  schools?: string[];
  enrollment?: string;
  parent_bank_name?: string;
  uploads?: Record<string, { url: string; uploadedAt: string }>;
}

export interface SessionData {
  messages: Message[];
  fields: CollectedFields;
}

// Independent students don't need parent_bank_name, so total is 13 for them
const DEPENDENT_FIELDS = 14;
const INDEPENDENT_FIELDS = 13;

export function computeProgress(fields: CollectedFields): number {
  const SKIP = fields.independent === true ? new Set(["parent_bank_name", "uploads"]) : new Set(["uploads"]);
  const total = fields.independent === true ? INDEPENDENT_FIELDS : DEPENDENT_FIELDS;
  const count = Object.keys(fields).filter(
    (k) => !SKIP.has(k) && fields[k as keyof CollectedFields] !== undefined
  ).length;
  return Math.min(count / total, 1);
}

export function encodeSession(data: SessionData): string {
  const trimmed: SessionData = {
    messages: data.messages.slice(-30),
    fields: data.fields,
  };
  return Buffer.from(JSON.stringify(trimmed)).toString("base64url");
}

export function decodeSession(cookie: string | undefined): SessionData {
  if (!cookie) return { messages: [], fields: {} };
  try {
    return JSON.parse(Buffer.from(cookie, "base64url").toString("utf-8")) as SessionData;
  } catch {
    return { messages: [], fields: {} };
  }
}
