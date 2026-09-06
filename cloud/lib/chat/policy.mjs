import { get_secret } from "../secrets.mjs";

export const LIMITS = Object.freeze({ message: 4000, context: 12000, turns: 8, daily: 50, output: 1024 });
export const MODEL = "gemini-2.5-flash-lite";
export class ChatError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export function chatConfiguration(env = process.env) {
  const database = get_secret("DATABASE_URL", env);
  const key = get_secret("GEMINI_API_KEY", env);
  const allowed = (env.JARVIS_CHAT_ALLOWED_EMAILS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  if (env.JARVIS_CLOUD_CHAT_ENABLED !== "true" || !database || !key || !allowed.length) return null;
  return { database, key, allowed, model: MODEL };
}
export function requireChatAccount(account, config) {
  if (!account) throw new ChatError(401, "unauthorized");
  if (!config) throw new ChatError(503, "unavailable");
  if (!account.emailVerified || !config.allowed.includes(account.email.toLowerCase())) throw new ChatError(403, "account_not_enabled");
  return account.id;
}
export function parseMessage(body) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!body || typeof body !== "object" || Object.keys(body).some(k => !["conversationId", "requestId", "text"].includes(k))) throw new ChatError(400, "invalid_message");
  if (!uuid.test(body.conversationId || "") || !uuid.test(body.requestId || "")) throw new ChatError(400, "invalid_message");
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > LIMITS.message || body.text.includes("\0")) throw new ChatError(400, "invalid_message");
  if (/AIza[\w-]{25,}|\bsk-[\w-]{20,}|-----BEGIN .*PRIVATE KEY-----/.test(body.text)) throw new ChatError(400, "credential_in_chat");
  return { conversationId: body.conversationId.toLowerCase(), requestId: body.requestId.toLowerCase(), text: body.text.trim() };
}
export function modelContext(turns, text) {
  const selected = [];
  let size = text.length;
  for (const turn of [...turns].reverse()) {
    if (selected.length >= LIMITS.turns || size + turn.user_text.length + turn.assistant_text.length > LIMITS.context) break;
    selected.unshift(turn); size += turn.user_text.length + turn.assistant_text.length;
  }
  return [...selected.flatMap(t => [
    { role: "user", parts: [{ text: t.user_text }] },
    { role: "model", parts: [{ text: t.assistant_text }] },
  ]), { role: "user", parts: [{ text }] }];
}
export function usageSummary(raw = {}) {
  const number = v => Number.isSafeInteger(v) && v >= 0 ? v : 0;
  const input = number(raw.promptTokenCount);
  const output = number(raw.candidatesTokenCount) + number(raw.thoughtsTokenCount);
  return { input, output, estimatedUsd: (input * 0.1 + output * 0.4) / 1000000 };
}
