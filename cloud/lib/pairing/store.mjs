import { ChatError } from "../chat/policy.mjs";
import { generatePairingCode, hashCode, generateDeviceToken, hashToken } from "./policy.mjs";

export class PairingStore {
  constructor(pool) {
    this.pool = pool;
  }

  async createPairing(ownerId) {
    if (!ownerId) throw new ChatError(401, "unauthorized");
    const code = generatePairingCode();
    const codeHash = hashCode(code);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE cloud_device_pairings_v1 SET status='expired' WHERE owner_id=$1 AND status='pending'",
        [ownerId]
      );
      const { rows } = await client.query(
        "INSERT INTO cloud_device_pairings_v1 (code_hash, owner_id, status, expires_at) " +
        "VALUES ($1, $2, 'pending', now() + INTERVAL '10 minutes') RETURNING expires_at",
        [codeHash, ownerId]
      );
      await client.query("COMMIT");
      return { code, expiresAt: rows[0].expires_at };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async claimPairing({ code, deviceId, deviceName }) {
    const codeHash = hashCode(code);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const check = await client.query(
        "SELECT owner_id, status, (expires_at < now()) AS is_expired FROM cloud_device_pairings_v1 WHERE code_hash=$1 FOR UPDATE",
        [codeHash]
      );
      if (check.rowCount === 0) {
        throw new ChatError(404, "pairing_code_not_found");
      }
      const row = check.rows[0];
      if (row.status !== "pending") {
        throw new ChatError(409, "pairing_code_already_used");
      }
      if (row.is_expired) {
        throw new ChatError(410, "pairing_code_expired");
      }

      const deviceToken = generateDeviceToken();
      const tokenHash = hashToken(deviceToken);

      await client.query(
        "UPDATE cloud_device_pairings_v1 SET status='revoked' WHERE owner_id=$1 AND device_id=$2 AND status='claimed'",
        [row.owner_id, deviceId]
      );

      await client.query(
        "UPDATE cloud_device_pairings_v1 SET status='claimed', claimed_at=now(), device_id=$2, device_name=$3, device_token_hash=$4 WHERE code_hash=$1",
        [codeHash, deviceId, deviceName, tokenHash]
      );

      await client.query("COMMIT");
      return {
        ownerId: row.owner_id,
        deviceToken,
        deviceId,
        deviceName,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async listDevices(ownerId) {
    if (!ownerId) throw new ChatError(401, "unauthorized");
    const { rows } = await this.pool.query(
      "SELECT device_id, device_name, claimed_at FROM cloud_device_pairings_v1 WHERE owner_id=$1 AND status='claimed' ORDER BY claimed_at DESC LIMIT 20",
      [ownerId]
    );
    return rows;
  }

  async revokeDevice(ownerId, deviceId) {
    if (!ownerId) throw new ChatError(401, "unauthorized");
    const { rowCount } = await this.pool.query(
      "UPDATE cloud_device_pairings_v1 SET status='revoked' WHERE owner_id=$1 AND device_id=$2 AND status='claimed'",
      [ownerId, deviceId]
    );
    return { revoked: rowCount > 0 };
  }

  async verifyDevice(ownerId, deviceToken) {
    if (!ownerId || !deviceToken) return null;
    const tokenHash = hashToken(deviceToken);
    const { rows } = await this.pool.query(
      "SELECT device_id, device_name, claimed_at FROM cloud_device_pairings_v1 WHERE owner_id=$1 AND device_token_hash=$2 AND status='claimed'",
      [ownerId, tokenHash]
    );
    return rows[0] || null;
  }
}
