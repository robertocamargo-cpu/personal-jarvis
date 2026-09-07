import { ChatError } from "../chat/policy.mjs";

export class MacChatStore {
  constructor(pool) {
    this.pool = pool;
  }

  async enqueueMessage({ ownerId, deviceId, conversationId, requestId, userText }) {
    if (!ownerId || !conversationId || !requestId || !userText) {
      throw new ChatError(400, "invalid_parameters");
    }

    // Se deviceId não for especificado, pega o device pareado mais recente do owner
    let targetDeviceId = deviceId;
    if (!targetDeviceId) {
      const devRes = await this.pool.query(
        "SELECT device_id FROM cloud_device_pairings_v1 WHERE owner_id = $1 AND status = 'claimed' ORDER BY claimed_at DESC LIMIT 1",
        [ownerId]
      );
      if (!devRes.rows || devRes.rows.length === 0) {
        throw new ChatError(404, "no_paired_mac");
      }
      targetDeviceId = devRes.rows[0].device_id;
    }

    const { rows } = await this.pool.query(
      `INSERT INTO cloud_mac_messages_v1 (
        owner_id, device_id, conversation_id, request_id, user_text, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      ON CONFLICT (request_id) DO UPDATE
      SET user_text = EXCLUDED.user_text,
          status = 'pending'
      RETURNING id, device_id, conversation_id, request_id, user_text, status, created_at`,
      [ownerId, targetDeviceId, conversationId, requestId, userText]
    );

    return rows[0];
  }

  async pollPendingMessages(deviceId) {
    if (!deviceId) throw new ChatError(400, "invalid_device_id");

    // Pega mensagens pendentes e atualiza status para 'processing'
    const { rows } = await this.pool.query(
      `UPDATE cloud_mac_messages_v1
       SET status = 'processing'
       WHERE id IN (
         SELECT id FROM cloud_mac_messages_v1
         WHERE device_id = $1 AND status = 'pending'
         ORDER BY created_at ASC
         LIMIT 5
       )
       RETURNING id, conversation_id, request_id, user_text, created_at`,
      [deviceId]
    );

    return rows;
  }

  async replyMessage({ deviceId, requestId, assistantText, status = "complete", error = null }) {
    if (!deviceId || !requestId) throw new ChatError(400, "invalid_parameters");

    const targetStatus = status === "failed" ? "failed" : "complete";

    const { rows } = await this.pool.query(
      `UPDATE cloud_mac_messages_v1
       SET assistant_text = $1,
           status = $2,
           error_message = $3,
           completed_at = now()
       WHERE device_id = $4 AND request_id = $5
       RETURNING id, request_id, conversation_id, status, assistant_text, completed_at`,
      [assistantText || "", targetStatus, error, deviceId, requestId]
    );

    if (!rows || rows.length === 0) {
      throw new ChatError(404, "message_not_found");
    }

    return rows[0];
  }

  async getMessageStatus(ownerId, conversationId, requestId) {
    if (!ownerId || !requestId) throw new ChatError(400, "invalid_parameters");

    const { rows } = await this.pool.query(
      `SELECT id, device_id, conversation_id, request_id, user_text, assistant_text, status, error_message, created_at, completed_at
       FROM cloud_mac_messages_v1
       WHERE owner_id = $1 AND request_id = $2
       LIMIT 1`,
      [ownerId, requestId]
    );

    if (!rows || rows.length === 0) {
      throw new ChatError(404, "message_not_found");
    }

    return rows[0];
  }
}
