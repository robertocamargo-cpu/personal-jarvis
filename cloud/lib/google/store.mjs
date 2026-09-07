import { ChatError } from "../chat/policy.mjs";
import { seal, unseal, SCOPES } from "./policy.mjs";
import { refresh } from "./provider.mjs";
export class GoogleStore {
  constructor(pool, config) { this.pool = pool; this.config = config; }
  async status(owner) {
    const { rows } = await this.pool.query("SELECT account_email,scopes,token_ciphertext IS NOT NULL AS connected,updated_at FROM cloud_google_connections_v1 WHERE owner_id=$1", [owner]);
    const row = rows[0];
    return { connected: row?.connected || false, email: row?.account_email || null, services: Object.fromEntries(Object.entries(SCOPES).map(([service, scope]) => [service, Boolean(row?.connected && row.scopes.includes(scope))])) };
  }
  async begin(owner, hash, verifier) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("INSERT INTO cloud_google_connections_v1(owner_id) VALUES ($1) ON CONFLICT(owner_id) DO UPDATE SET version=cloud_google_connections_v1.version+1 RETURNING version", [owner]);
      await client.query("INSERT INTO cloud_google_states_v1(owner_id,state_hash,verifier_ciphertext,version) VALUES ($1,$2,$3,$4) ON CONFLICT(owner_id) DO UPDATE SET state_hash=$2,verifier_ciphertext=$3,version=$4,expires_at=now()+interval '10 minutes'", [owner, hash, seal(verifier,owner,this.config.encryptionKey), result.rows[0].version]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async consume(owner, hash) {
    const { rows } = await this.pool.query("DELETE FROM cloud_google_states_v1 WHERE owner_id=$1 AND state_hash=$2 AND expires_at>now() RETURNING verifier_ciphertext,version", [owner, hash]);
    if (!rows.length) throw new ChatError(400, "invalid_state");
    return { verifier: unseal(rows[0].verifier_ciphertext,owner,this.config.encryptionKey), version: rows[0].version };
  }
  async finish(owner, version, token, email, scopes) {
    const result = await this.pool.query("UPDATE cloud_google_connections_v1 SET token_ciphertext=$3,account_email=$4,scopes=$5,expires_at=now()+$6*interval '1 second',updated_at=now() WHERE owner_id=$1 AND version=$2 RETURNING owner_id", [owner, version, seal({ access: token.access_token, refresh: token.refresh_token },owner,this.config.encryptionKey), email, scopes, token.expires_in]);
    if (!result.rowCount) throw new ChatError(409, "connection_changed");
  }
  async disconnect(owner) {
    // Incrementing the generation prevents an in-flight callback from reconnecting.
    await this.pool.query("UPDATE cloud_google_connections_v1 SET version=version+1,token_ciphertext=NULL,account_email=NULL,scopes='{}',expires_at=NULL,updated_at=now() WHERE owner_id=$1", [owner]);
    await this.pool.query("DELETE FROM cloud_google_states_v1 WHERE owner_id=$1", [owner]);
  }
  async access(owner, service, refresher = refresh) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT token_ciphertext,scopes,expires_at FROM cloud_google_connections_v1 WHERE owner_id=$1 FOR UPDATE", [owner]);
      const row = rows[0];
      if (!row?.token_ciphertext) throw new ChatError(409, "not_connected");
      if (!row.scopes.includes(SCOPES[service])) throw new ChatError(403, "permission_denied");
      let token = unseal(row.token_ciphertext,owner,this.config.encryptionKey);
      if (new Date(row.expires_at).getTime() < Date.now()+60000) {
        const fresh = await refresher(this.config,token.refresh);
        if (!fresh.access_token || !Number.isFinite(fresh.expires_in) || fresh.expires_in<=0) throw new ChatError(502, "reconnect");
        token = { access: fresh.access_token, refresh: fresh.refresh_token || token.refresh };
        await client.query("UPDATE cloud_google_connections_v1 SET token_ciphertext=$2,expires_at=now()+$3*interval '1 second',updated_at=now() WHERE owner_id=$1", [owner, seal(token,owner,this.config.encryptionKey), fresh.expires_in]);
      }
      await client.query("COMMIT"); return token.access;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
