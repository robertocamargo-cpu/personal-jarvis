import { ChatError } from "../chat/policy.mjs";

export class ApprovalsStore {
  constructor(pool) {
    this.pool = pool;
  }

  async publishApproval({
    ownerId,
    deviceId,
    traceId,
    toolName,
    riskTier,
    reason,
    argsPreview,
    expiresAt,
  }) {
    if (!ownerId || !deviceId || !traceId) {
      throw new ChatError(400, "invalid_parameters");
    }

    const { rows } = await this.pool.query(
      `INSERT INTO cloud_tool_approvals_v1 (
        owner_id, device_id, trace_id, tool_name, risk_tier, reason, args_preview, expires_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      ON CONFLICT (device_id, trace_id) DO UPDATE
      SET tool_name = EXCLUDED.tool_name,
          risk_tier = EXCLUDED.risk_tier,
          reason = EXCLUDED.reason,
          args_preview = EXCLUDED.args_preview,
          expires_at = EXCLUDED.expires_at,
          status = 'pending'
      RETURNING id, trace_id, tool_name, risk_tier, status, expires_at`,
      [ownerId, deviceId, traceId, toolName, riskTier, reason, argsPreview, expiresAt]
    );

    return rows[0];
  }

  async listApprovals(ownerId) {
    if (!ownerId) throw new ChatError(401, "unauthorized");

    // Marca as expiradas automaticamente
    await this.pool.query(
      `UPDATE cloud_tool_approvals_v1
       SET status = 'expired'
       WHERE owner_id = $1 AND status = 'pending' AND expires_at < now()`,
      [ownerId]
    );

    const { rows } = await this.pool.query(
      `SELECT
        a.id,
        a.device_id,
        d.device_name,
        a.trace_id,
        a.tool_name,
        a.risk_tier,
        a.reason,
        a.args_preview,
        a.status,
        a.decision_by,
        a.decision_reason,
        a.created_at,
        a.expires_at,
        a.decided_at
       FROM cloud_tool_approvals_v1 a
       LEFT JOIN cloud_device_pairings_v1 d ON a.device_id = d.device_id
       WHERE a.owner_id = $1
       ORDER BY
         CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END,
         a.created_at DESC
       LIMIT 30`,
      [ownerId]
    );

    return rows;
  }

  async getApprovalStatus(deviceId, traceId) {
    if (!deviceId || !traceId) throw new ChatError(400, "invalid_parameters");

    const { rows } = await this.pool.query(
      `SELECT
        id,
        device_id,
        trace_id,
        tool_name,
        status,
        decision_by,
        decision_reason,
        expires_at,
        decided_at,
        (expires_at < now() AND status = 'pending') AS is_expired
       FROM cloud_tool_approvals_v1
       WHERE device_id = $1 AND trace_id = $2
       LIMIT 1`,
      [deviceId, traceId]
    );

    if (!rows || rows.length === 0) {
      throw new ChatError(404, "approval_not_found");
    }

    const row = rows[0];
    if (row.is_expired) {
      await this.pool.query(
        "UPDATE cloud_tool_approvals_v1 SET status = 'expired' WHERE id = $1",
        [row.id]
      );
      row.status = "expired";
    }

    return {
      trace_id: row.trace_id,
      tool_name: row.tool_name,
      status: row.status,
      decision_by: row.decision_by,
      decision_reason: row.decision_reason,
      decided_at: row.decided_at,
    };
  }

  async decideApproval({ ownerId, traceId, decision, decisionBy, reason }) {
    if (!ownerId || !traceId || !decision) {
      throw new ChatError(400, "invalid_parameters");
    }

    const targetStatus = decision === "approve" ? "approved" : "denied";

    const { rows } = await this.pool.query(
      `UPDATE cloud_tool_approvals_v1
       SET status = $1,
           decision_by = $2,
           decision_reason = $3,
           decided_at = now()
       WHERE owner_id = $4
         AND trace_id = $5
         AND status = 'pending'
         AND expires_at >= now()
       RETURNING id, trace_id, tool_name, status, decision_by, decided_at`,
      [targetStatus, decisionBy, reason, ownerId, traceId]
    );

    if (!rows || rows.length === 0) {
      // Check if it already expired or was already decided
      const check = await this.pool.query(
        "SELECT status, expires_at < now() AS expired FROM cloud_tool_approvals_v1 WHERE owner_id = $1 AND trace_id = $2",
        [ownerId, traceId]
      );
      if (check.rows.length === 0) {
        throw new ChatError(404, "approval_not_found");
      }
      const existing = check.rows[0];
      if (existing.status !== "pending") {
        throw new ChatError(409, "already_decided");
      }
      if (existing.expired) {
        throw new ChatError(410, "approval_expired");
      }
      throw new ChatError(400, "cannot_decide_approval");
    }

    return rows[0];
  }
}
