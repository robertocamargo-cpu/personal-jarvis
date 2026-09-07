import crypto from "node:crypto";
import { ChatError } from "../chat/policy.mjs";

export const PAIRING_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes

export function generatePairingCode() {
  const bytes = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `JRV-${bytes.slice(0, 4)}-${bytes.slice(4, 8)}`;
}

export function cleanCode(raw) {
  if (typeof raw !== "string") return "";
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.startsWith("JRV") && cleaned.length === 11) {
    return `JRV-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
  }
  if (cleaned.length === 8) {
    return `JRV-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  }
  return "";
}

export function hashCode(code) {
  const normalized = cleanCode(code);
  if (!normalized) throw new ChatError(400, "invalid_pairing_code");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function generateDeviceToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token) {
  if (typeof token !== "string" || token.length < 32) {
    throw new ChatError(400, "invalid_device_token");
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function parseClaimPayload(body) {
  if (!body || typeof body !== "object") throw new ChatError(400, "invalid_request");
  const code = cleanCode(body.code);
  if (!code) throw new ChatError(400, "invalid_pairing_code");

  const rawDeviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
  if (!rawDeviceId || rawDeviceId.length > 128 || !/^[a-zA-Z0-9_\-\.:]+$/.test(rawDeviceId)) {
    throw new ChatError(400, "invalid_device_id");
  }

  const rawName = typeof body.device_name === "string" ? body.device_name.trim().slice(0, 128) : "Mac Desktop";
  return { code, deviceId: rawDeviceId, deviceName: rawName };
}

export function parseRevokePayload(body) {
  if (!body || typeof body !== "object") throw new ChatError(400, "invalid_request");
  const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
  if (!deviceId || deviceId.length > 128) throw new ChatError(400, "invalid_device_id");
  return { deviceId };
}
