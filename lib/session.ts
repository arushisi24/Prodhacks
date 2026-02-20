export interface Message {
  role: "user" | "assistant";
  content: string;
}

export type UserRole = "student" | "parent";

export interface CollectedFields {
  user_role?: UserRole;
  student_name?: string;
  student_email?: string;
  student_dob?: string;
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
  parent_income_range?: string;
  parent_asset_range?: string;
  parent_filed_taxes?: boolean;
  parent_has_tax_return?: boolean;
  parent_bank_name?: string;
  uploads?: Record<string, { url: string; uploadedAt: string }>;
}

export interface SessionData {
  messages: Message[];
  fields: CollectedFields;
}

const PARENT_ONLY_FIELDS = ["parent_income_range", "parent_asset_range", "parent_filed_taxes", "parent_has_tax_return", "parent_bank_name"];

// 21 fields for dependent (all fields), 16 for independent (no parent fields)
const DEPENDENT_FIELDS = 21;
const INDEPENDENT_FIELDS = 16;

export function computeProgress(fields: CollectedFields): number {
  const SKIP = fields.independent === true
    ? new Set([...PARENT_ONLY_FIELDS, "uploads"])
    : new Set(["uploads"]);
  const total = fields.independent === true ? INDEPENDENT_FIELDS : DEPENDENT_FIELDS;
  const count = Object.keys(fields).filter(
    (k) => !SKIP.has(k) && fields[k as keyof CollectedFields] !== undefined
  ).length;
  return Math.min(count / total, 1);
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
