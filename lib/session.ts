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
}

export interface SessionData {
  messages: Message[];
  fields: CollectedFields;
}

const TOTAL_FIELDS = 14;

export function computeProgress(fields: CollectedFields): number {
  const count = Object.keys(fields).filter(
    (k) => fields[k as keyof CollectedFields] !== undefined
  ).length;
  return Math.min(count / TOTAL_FIELDS, 1);
}

export function encodeSession(data: SessionData): string {
  const trimmed: SessionData = {
    messages: data.messages.slice(-15),
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
