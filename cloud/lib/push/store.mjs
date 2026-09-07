import { ChatError } from "../chat/policy.mjs";

export class PushStore {
  constructor(pool) {
    this.pool = pool;
  }

  async saveSubscription(ownerId, { endpoint, keys }, userAgent = "") {
    if (!ownerId || !endpoint || !keys?.p256dh || !keys?.auth) {
      throw new ChatError(400, "invalid_subscription");
    }

    const { rows } = await this.pool.query(
      `INSERT INTO cloud_push_subscriptions_v1 (
        owner_id, endpoint, p256dh, auth, user_agent, updated_at
      ) VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (endpoint) DO UPDATE
      SET owner_id = EXCLUDED.owner_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          user_agent = EXCLUDED.user_agent,
          updated_at = now()
      RETURNING id, endpoint, created_at`,
      [ownerId, endpoint, keys.p256dh, keys.auth, userAgent.slice(0, 500)]
    );

    return rows[0];
  }

  async listSubscriptions(ownerId) {
    if (!ownerId) throw new ChatError(401, "unauthorized");
    const { rows } = await this.pool.query(
      `SELECT endpoint, p256dh, auth FROM cloud_push_subscriptions_v1 WHERE owner_id = $1`,
      [ownerId]
    );
    return rows;
  }

  async removeSubscription(endpoint) {
    if (!endpoint) return false;
    const { rowCount } = await this.pool.query(
      `DELETE FROM cloud_push_subscriptions_v1 WHERE endpoint = $1`,
      [endpoint]
    );
    return rowCount > 0;
  }
}
