import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { get_secret } from "../secrets.mjs";
import { ChatError } from "../chat/policy.mjs";
export const CALLBACK = "https://jarvis-bob.vercel.app/api/google/callback";
export const COOKIE = "__Host-jarvis-google-state";
export const SCOPES = Object.freeze({ gmail: "https://www.googleapis.com/auth/gmail.readonly", calendar: "https://www.googleapis.com/auth/calendar.events.readonly", drive: "https://www.googleapis.com/auth/drive.metadata.readonly" });
export function googleConfiguration(env = process.env) {
  const database = get_secret("DATABASE_URL", env), clientId = get_secret("GOOGLE_OAUTH_CLIENT_ID", env), clientSecret = get_secret("GOOGLE_OAUTH_CLIENT_SECRET", env), encryptionKey = get_secret("JARVIS_GOOGLE_TOKEN_KEY", env);
  const allowed = (env.JARVIS_CHAT_ALLOWED_EMAILS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  if (env.JARVIS_GOOGLE_INTEGRATION_ENABLED !== "true" || !database || !clientId || !clientSecret || !/^[a-f0-9]{64}$/i.test(encryptionKey || "") || !allowed.length) return null;
  return { database, clientId, clientSecret, encryptionKey, allowed };
}
export function seal(value, owner, key) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function unseal(value, owner, key) {
  const bytes = Buffer.from(value, "base64"), cipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), bytes.subarray(0,12));
  cipher.setAAD(Buffer.from(owner)); cipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"));
}
export const digest = value => createHash("sha256").update(value).digest("hex");
export function stateMatches(state, cookie) {
  return typeof state === "string" && typeof cookie === "string" && /^[\w-]{43}$/.test(state) && state.length === cookie.length && timingSafeEqual(Buffer.from(state), Buffer.from(cookie));
}
export function authorization(config, email) {
  const state = randomBytes(32).toString("base64url"), verifier = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: CALLBACK, response_type: "code", scope: ["openid", "email", ...Object.values(SCOPES)].join(" "), access_type: "offline", prompt: "consent", login_hint: email, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return { state, verifier, url: url.toString() };
}
export function parseOperation(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !["operation", "service"].includes(k))) throw new ChatError(400, "invalid_request");
  if (body.operation === "disconnect" && !body.service) return body;
  if (body.operation === "read" && Object.hasOwn(SCOPES, body.service)) return body;
  throw new ChatError(400, "invalid_request");
}
