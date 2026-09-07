import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePublishApprovalPayload,
  parseDecisionPayload,
  ALLOWED_RISK_TIERS,
  ALLOWED_DECISIONS,
} from "../lib/approvals/policy.mjs";
import { ApprovalsStore } from "../lib/approvals/store.mjs";

test("policy: parsePublishApprovalPayload valid input", () => {
  const parsed = parsePublishApprovalPayload({
    trace_id: "trace-1234",
    tool_name: "bash",
    risk_tier: "ask",
    reason: "Comando requer autorização",
    args_preview: '{"cmd": "ls -la"}',
    expires_at_ms: Date.now() + 60000,
  });

  assert.equal(parsed.traceId, "trace-1234");
  assert.equal(parsed.toolName, "bash");
  assert.equal(parsed.riskTier, "ask");
  assert.equal(parsed.reason, "Comando requer autorização");
  assert.equal(parsed.argsPreview, '{"cmd": "ls -la"}');
  assert.ok(parsed.expiresAt instanceof Date);
});

test("policy: parsePublishApprovalPayload validation errors", () => {
  assert.throws(() => parsePublishApprovalPayload(null), /invalid_payload/);
  assert.throws(() => parsePublishApprovalPayload({ trace_id: "" }), /invalid_trace_id/);
  assert.throws(() => parsePublishApprovalPayload({ trace_id: "t-1", tool_name: "" }), /invalid_tool_name/);
  assert.throws(() => parsePublishApprovalPayload({ trace_id: "t-1", tool_name: "t", risk_tier: "invalid" }), /invalid_risk_tier/);
});

test("policy: parseDecisionPayload valid and errors", () => {
  const approve = parseDecisionPayload({
    trace_id: "trace-1234",
    decision: "approve",
  });
  assert.equal(approve.decision, "approve");

  const deny = parseDecisionPayload({
    trace_id: "trace-1234",
    decision: "deny",
    reason: "Operação perigosa",
  });
  assert.equal(deny.decision, "deny");
  assert.equal(deny.reason, "Operação perigosa");

  assert.throws(() => parseDecisionPayload(null), /invalid_payload/);
  assert.throws(() => parseDecisionPayload({ trace_id: "" }), /invalid_trace_id/);
  assert.throws(() => parseDecisionPayload({ trace_id: "t-1", decision: "unknown" }), /invalid_decision/);
});

test("ApprovalsStore with mock pool", async () => {
  const queries = [];
  const mockPool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("INSERT INTO cloud_tool_approvals_v1")) {
        return {
          rows: [
            {
              id: "appr-1",
              trace_id: params[2],
              tool_name: params[3],
              risk_tier: params[4],
              status: "pending",
              expires_at: params[7],
            },
          ],
        };
      }
      if (sql.includes("FROM cloud_tool_approvals_v1 a")) {
        return {
          rows: [
            {
              id: "appr-1",
              device_id: "dev-1",
              device_name: "Mac",
              trace_id: "trace-1",
              tool_name: "bash",
              risk_tier: "ask",
              status: "pending",
              expires_at: new Date(Date.now() + 60000),
            },
          ],
        };
      }
      if (sql.includes("WHERE device_id = $1 AND trace_id = $2")) {
        return {
          rows: [
            {
              id: "appr-1",
              device_id: "dev-1",
              trace_id: "trace-1",
              tool_name: "bash",
              status: "approved",
              decision_by: "user@test.com",
              decision_reason: null,
              expires_at: new Date(Date.now() + 60000),
              decided_at: new Date(),
              is_expired: false,
            },
          ],
        };
      }
      if (sql.includes("UPDATE cloud_tool_approvals_v1") && sql.includes("status = $1")) {
        return {
          rows: [
            {
              id: "appr-1",
              trace_id: "trace-1",
              tool_name: "bash",
              status: params[0],
              decision_by: params[1],
              decided_at: new Date(),
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    },
  };

  const store = new ApprovalsStore(mockPool);

  const published = await store.publishApproval({
    ownerId: "owner-1",
    deviceId: "dev-1",
    traceId: "trace-1",
    toolName: "bash",
    riskTier: "ask",
    reason: "Test",
    argsPreview: "echo hi",
    expiresAt: new Date(Date.now() + 60000),
  });

  assert.equal(published.trace_id, "trace-1");
  assert.equal(published.status, "pending");

  const list = await store.listApprovals("owner-1");
  assert.equal(list.length, 1);
  assert.equal(list[0].tool_name, "bash");

  const decided = await store.decideApproval({
    ownerId: "owner-1",
    traceId: "trace-1",
    decision: "approve",
    decisionBy: "user@test.com",
    reason: null,
  });
  assert.equal(decided.status, "approved");

  const polled = await store.getApprovalStatus("dev-1", "trace-1");
  assert.equal(polled.status, "approved");
  assert.equal(polled.decision_by, "user@test.com");
});
