import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { ChatStore } from "../lib/chat/store.mjs";
import { MODEL } from "../lib/chat/policy.mjs";

test("real PostgreSQL: ownership, restart persistence, concurrency, quota and idempotency", { skip: !process.env.JARVIS_TEST_POSTGRES_DSN }, async () => {
  const connectionString = process.env.JARVIS_TEST_POSTGRES_DSN;
  const schema = "cloud_chat_test_" + randomUUID().replaceAll("-", "");
  const admin = new pg.Client({ connectionString }); await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, max: 3 });
  try {
    const migration = await readFile(new URL("../migrations/001_cloud_chat.sql", import.meta.url), "utf8");
    await pool.query(migration); await pool.query(migration);
    const store = new ChatStore(pool), id = randomUUID(), requestId = randomUUID();
    const message = { conversationId: id, requestId, text: "Olá, teste de persistência" };
    const reserved = await store.reserve("owner-a", message, MODEL); assert.equal(reserved.used, 1);
    await assert.rejects(store.reserve("owner-a", { ...message, requestId: randomUUID() }, MODEL), /busy/);
    await assert.rejects(store.history("owner-b", id), /not_found/);
    assert.deepEqual(await store.list("owner-b"), []);
    await assert.rejects(store.complete("owner-b", requestId, "wrong", { input: 1, output: 1, estimatedUsd: 0 }), /lease_expired/);
    await store.complete("owner-a", requestId, "Olá!", { input: 10, output: 5, estimatedUsd: 0.000003 });
    assert.equal((await new ChatStore(pool).history("owner-a", id)).turns[0].assistant_text, "Olá!");
    assert.equal((await store.reserve("owner-a", message, MODEL)).replay.assistant_text, "Olá!");
    assert.equal((await store.budget("owner-a")).used, 1);
    await assert.rejects(store.reserve("owner-a", { ...message, text: "changed" }, MODEL), /request_conflict/);
    const other = { ...message, requestId: randomUUID() };
    await store.reserve("owner-b", other, MODEL); await store.fail("owner-b", other.requestId);
    assert.equal((await store.history("owner-a", id)).turns.length, 1);
    assert.equal((await store.history("owner-b", id)).turns[0].status, "failed");
    await pool.query("UPDATE cloud_chat_budget_v1 SET attempts=50 WHERE owner_id='owner-a'");
    await assert.rejects(store.reserve("owner-a", { ...message, requestId: randomUUID() }, MODEL), /daily_limit/);
    const attempts = await Promise.allSettled([1,2].map(() => store.reserve("concurrent", { ...message, requestId: randomUUID() }, MODEL)));
    assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
    await pool.query("UPDATE cloud_chat_turns_v1 SET expires_at=now()-interval '1 second' WHERE owner_id='concurrent'");
    assert.equal((await store.history("concurrent", id)).turns[0].status, "failed");
    await store.reserve("concurrent", { ...message, requestId: randomUUID() }, MODEL);
    const usage = await store.usage("owner-a");
    assert.equal(usage.days.length, 30);
    assert.deepEqual(usage.totals, { completed: 1, failed: 0, pending: 0, input: 10, output: 5, estimated_usd: 0.000003 });
    assert.equal((await store.usage("owner-b")).totals.failed, 1);
    assert.equal((await store.usage("owner-b")).totals.estimated_usd, 0);
    const concurrentUsage = (await store.usage("concurrent")).totals;
    assert.equal(concurrentUsage.failed, 1);
    assert.equal(concurrentUsage.pending, 1);
    assert.equal((await store.usage("unrelated")).totals.completed, 0);
    // The oldest included day starts at local midnight, not UTC midnight.
    await pool.query(`UPDATE cloud_chat_turns_v1 SET created_at=
      (((now() AT TIME ZONE 'America/Sao_Paulo')::date-29)::timestamp AT TIME ZONE 'America/Sao_Paulo')
      WHERE owner_id='owner-a'`);
    const boundary = await store.usage("owner-a");
    assert.equal(boundary.days.at(-1).completed, 1);
    assert.equal(boundary.days[0].completed, 0);
    await pool.query("UPDATE cloud_chat_turns_v1 SET created_at=created_at-interval '1 millisecond' WHERE owner_id='owner-a'");
    assert.equal((await store.usage("owner-a")).totals.completed, 0);
  } finally {
    await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  }
});
