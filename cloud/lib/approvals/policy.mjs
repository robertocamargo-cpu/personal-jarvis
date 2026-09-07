import { ChatError } from "../chat/policy.mjs";

export const ALLOWED_RISK_TIERS = new Set(["safe", "monitor", "ask", "block"]);
export const ALLOWED_DECISIONS = new Set(["approve", "deny"]);

export function parsePublishApprovalPayload(data) {
  if (!data || typeof data !== "object") {
    throw new ChatError(400, "invalid_payload");
  }

  const traceId = String(data.trace_id || "").trim();
  if (!traceId || traceId.length > 128) {
    throw new ChatError(400, "invalid_trace_id");
  }

  const toolName = String(data.tool_name || "").trim();
  if (!toolName || toolName.length > 128) {
    throw new ChatError(400, "invalid_tool_name");
  }

  const riskTier = String(data.risk_tier || "ask").trim().toLowerCase();
  if (!ALLOWED_RISK_TIERS.has(riskTier)) {
    throw new ChatError(400, "invalid_risk_tier");
  }

  const reason = String(data.reason || "").slice(0, 500);
  const argsPreview = String(data.args_preview || "").slice(0, 4000);

  let expiresAt;
  if (data.expires_at_ms) {
    expiresAt = new Date(Number(data.expires_at_ms));
  } else if (data.expires_at_ns) {
    expiresAt = new Date(Math.floor(Number(data.expires_at_ns) / 1_000_000));
  } else if (data.expires_at) {
    expiresAt = new Date(data.expires_at);
  } else {
    // Default 2 minutes
    expiresAt = new Date(Date.now() + 120_000);
  }

  if (isNaN(expiresAt.getTime())) {
    throw new ChatError(400, "invalid_expires_at");
  }

  return {
    traceId,
    toolName,
    riskTier,
    reason,
    argsPreview,
    expiresAt,
  };
}

export function parseDecisionPayload(data) {
  if (!data || typeof data !== "object") {
    throw new ChatError(400, "invalid_payload");
  }

  const traceId = String(data.trace_id || "").trim();
  if (!traceId || traceId.length > 128) {
    throw new ChatError(400, "invalid_trace_id");
  }

  const decision = String(data.decision || "").trim().toLowerCase();
  if (!ALLOWED_DECISIONS.has(decision)) {
    throw new ChatError(400, "invalid_decision");
  }

  const reason = String(data.reason || "").slice(0, 500);

  return {
    traceId,
    decision,
    reason,
  };
}
