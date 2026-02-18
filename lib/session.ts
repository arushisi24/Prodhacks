export interface Message {
  role: "user" | "assistant";
  content: string;
}

export function encodeSession(messages: Message[]): string {
  // Keep last 20 messages to stay within cookie size limits
  const trimmed = messages.slice(-20);
  return Buffer.from(JSON.stringify(trimmed)).toString("base64url");
}

export function decodeSession(cookie: string | undefined): Message[] {
  if (!cookie) return [];
  try {
    return JSON.parse(Buffer.from(cookie, "base64url").toString("utf-8")) as Message[];
  } catch {
    return [];
  }
}
