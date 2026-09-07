import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { GoogleStore } from "../lib/google/store.mjs";
import { SCOPES,digest } from "../lib/google/policy.mjs";
test("Google PostgreSQL state replay, expiry, account isolation, reconnect races and serialized refresh",{skip:!process.env.JARVIS_TEST_POSTGRES_DSN},async()=>{
  const connectionString=process.env.JARVIS_TEST_POSTGRES_DSN,schema="google_test_"+randomUUID().replaceAll("-","");
  const admin=new pg.Client({connectionString});await admin.connect();await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new pg.Pool({connectionString,options:`-c search_path=${schema}`,max:3});
  try{
    const sql=await readFile(new URL("../migrations/002_google_connections.sql",import.meta.url),"utf8");await pool.query(sql);await pool.query(sql);
    const store=new GoogleStore(pool,{encryptionKey:"b".repeat(64)}),token={access_token:"access",refresh_token:"refresh",expires_in:3600};
    await store.begin("a",digest("state"),"verifier");
    await assert.rejects(store.consume("b",digest("state")),/invalid_state/);
    const flow=await store.consume("a",digest("state"));assert.equal(flow.verifier,"verifier");
    await assert.rejects(store.consume("a",digest("state")),/invalid_state/);
    await store.finish("a",flow.version,token,"owner@example.test",[SCOPES.gmail]);
    assert.equal((await store.status("a")).services.gmail,true);assert.equal((await store.status("b")).connected,false);
    await assert.rejects(store.access("b","gmail"),/not_connected/);
    await assert.rejects(store.access("a","drive"),/permission_denied/);
    assert.equal(await store.access("a","gmail"),"access");
    await pool.query("UPDATE cloud_google_connections_v1 SET expires_at=now()-interval '1 minute' WHERE owner_id='a'");
    let refreshes=0;const refresher=async()=>{refreshes++;return {access_token:"fresh",expires_in:3600};};
    assert.deepEqual(await Promise.all([store.access("a","gmail",refresher),store.access("a","gmail",refresher)]),["fresh","fresh"]);assert.equal(refreshes,1);
    await store.begin("a",digest("next"),"next-verifier");const next=await store.consume("a",digest("next"));
    await store.disconnect("a");await assert.rejects(store.finish("a",next.version,token,"owner@example.test",[SCOPES.gmail]),/connection_changed/);
    assert.equal((await store.status("a")).connected,false);
    await store.begin("a",digest("expired"),"verifier");await pool.query("UPDATE cloud_google_states_v1 SET expires_at=now()-interval '1 second'");
    await assert.rejects(store.consume("a",digest("expired")),/invalid_state/);
    const rows=(await pool.query("SELECT token_ciphertext FROM cloud_google_connections_v1")).rows;assert.equal(rows[0].token_ciphertext,null);
  }finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
