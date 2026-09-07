import pg from "pg";
import { ChatError, LIMITS } from "./policy.mjs";

export function createPool(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 7000, statement_timeout: 7000, allowExitOnIdle: true });
  pool.on("error", () => console.error("Cloud chat idle database connection failed"));
  return pool;
}

// All owner arguments originate in a verified server session, never request JSON.
export class ChatStore {
  constructor(pool) { this.pool = pool; }
  async list(owner) {
    const { rows } = await this.pool.query("SELECT id,title,created_at,updated_at FROM cloud_chat_conversations_v1 WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 50", [owner]);
    return rows;
  }
  async history(owner, id) {
    const parent = await this.pool.query("SELECT id,title FROM cloud_chat_conversations_v1 WHERE owner_id=$1 AND id=$2", [owner, id]);
    if (!parent.rowCount) throw new ChatError(404, "not_found");
    const { rows } = await this.pool.query("SELECT request_id,user_text,assistant_text,CASE WHEN status='pending' AND expires_at<now() THEN 'failed' ELSE status END AS status,model,input_tokens,output_tokens,estimated_usd,created_at FROM cloud_chat_turns_v1 WHERE owner_id=$1 AND conversation_id=$2 ORDER BY created_at,request_id LIMIT 200", [owner, id]);
    return { conversation: parent.rows[0], turns: rows };
  }
  async budget(owner) {
    const { rows } = await this.pool.query("SELECT attempts FROM cloud_chat_budget_v1 WHERE owner_id=$1 AND day=(now() AT TIME ZONE 'America/Sao_Paulo')::date", [owner]);
    return { used: rows[0]?.attempts || 0, limit: LIMITS.daily };
  }
  async usage(owner) {
    const { rows } = await this.pool.query(`
      WITH calendar AS (
        SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today
      ), days AS (
        SELECT today-offset_days AS day FROM calendar CROSS JOIN generate_series(0,29) AS offset_days
      ), daily AS (
        SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
          count(*) FILTER (WHERE status='complete')::int AS completed,
          count(*) FILTER (WHERE status='failed' OR (status='pending' AND expires_at<now()))::int AS failed,
          count(*) FILTER (WHERE status='pending' AND expires_at>=now())::int AS pending,
          coalesce(sum(input_tokens) FILTER (WHERE status='complete'),0)::text AS input,
          coalesce(sum(output_tokens) FILTER (WHERE status='complete'),0)::text AS output,
          coalesce(sum(estimated_usd) FILTER (WHERE status='complete'),0)::text AS estimated_usd
        FROM cloud_chat_turns_v1, calendar
        WHERE owner_id=$1 AND created_at >= ((today-29)::timestamp AT TIME ZONE 'America/Sao_Paulo')
          AND created_at < ((today+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
        GROUP BY 1
      )
      SELECT to_char(days.day,'YYYY-MM-DD') AS day,
        coalesce(completed,0) AS completed, coalesce(failed,0) AS failed,
        coalesce(pending,0) AS pending, coalesce(input,'0') AS input,
        coalesce(output,'0') AS output, coalesce(estimated_usd,'0') AS estimated_usd
      FROM days LEFT JOIN daily USING(day) ORDER BY days.day DESC`, [owner]);
    const totals = { completed: 0, failed: 0, pending: 0, input: 0, output: 0, estimated_usd: 0 };
    const days = rows.map(row => {
      const day = { day: row.day };
      for (const key of Object.keys(totals)) { day[key] = Number(row[key]); totals[key] += day[key]; }
      return day;
    });
    return { days, totals };
  }
  async reserve(owner, message, model) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [owner]);
      const previous = await client.query("SELECT * FROM cloud_chat_turns_v1 WHERE owner_id=$1 AND request_id=$2", [owner, message.requestId]);
      if (previous.rowCount) {
        const turn = previous.rows[0];
        if (turn.user_text !== message.text || turn.conversation_id !== message.conversationId) throw new ChatError(409, "request_conflict");
        if (turn.status !== "complete") throw new ChatError(409, "request_already_used");
        await client.query("COMMIT"); return { replay: turn };
      }
      await client.query("UPDATE cloud_chat_turns_v1 SET status='failed' WHERE owner_id=$1 AND status='pending' AND expires_at<now()", [owner]);
      const pending = await client.query("SELECT 1 FROM cloud_chat_turns_v1 WHERE owner_id=$1 AND status='pending' LIMIT 1", [owner]);
      if (pending.rowCount) throw new ChatError(409, "busy");
      const size = await client.query("SELECT count(*)::int AS n FROM cloud_chat_turns_v1 WHERE owner_id=$1 AND conversation_id=$2", [owner, message.conversationId]);
      if (size.rows[0].n >= 200) throw new ChatError(409, "conversation_full");
      const quota = await client.query("INSERT INTO cloud_chat_budget_v1 VALUES ($1,(now() AT TIME ZONE 'America/Sao_Paulo')::date,1) ON CONFLICT(owner_id,day) DO UPDATE SET attempts=cloud_chat_budget_v1.attempts+1 WHERE cloud_chat_budget_v1.attempts<$2 RETURNING attempts", [owner, LIMITS.daily]);
      if (!quota.rowCount) throw new ChatError(429, "daily_limit");
      await client.query("INSERT INTO cloud_chat_conversations_v1(owner_id,id,title) VALUES ($1,$2,$3) ON CONFLICT(owner_id,id) DO UPDATE SET updated_at=now()", [owner, message.conversationId, message.text.slice(0,72)]);
      await client.query("INSERT INTO cloud_chat_turns_v1(owner_id,request_id,conversation_id,user_text,status,model) VALUES ($1,$2,$3,$4,'pending',$5)", [owner, message.requestId, message.conversationId, message.text, model]);
      const { rows } = await client.query("SELECT user_text,assistant_text FROM (SELECT user_text,assistant_text,created_at FROM cloud_chat_turns_v1 WHERE owner_id=$1 AND conversation_id=$2 AND status='complete' ORDER BY created_at DESC LIMIT $3) t ORDER BY created_at", [owner, message.conversationId, LIMITS.turns]);
      await client.query("COMMIT"); return { turns: rows, used: quota.rows[0].attempts };
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }
  async complete(owner, requestId, text, usage) {
    const result = await this.pool.query("UPDATE cloud_chat_turns_v1 SET status='complete',assistant_text=$3,input_tokens=$4,output_tokens=$5,estimated_usd=$6 WHERE owner_id=$1 AND request_id=$2 AND status='pending' AND expires_at>now() RETURNING request_id", [owner, requestId, text, usage.input, usage.output, usage.estimatedUsd]);
    if (!result.rowCount) throw new ChatError(409, "lease_expired");
  }
  async fail(owner, requestId) {
    await this.pool.query("UPDATE cloud_chat_turns_v1 SET status='failed' WHERE owner_id=$1 AND request_id=$2 AND status='pending'", [owner, requestId]);
  }
}
