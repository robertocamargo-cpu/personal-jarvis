import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { chatConfiguration, requireChatAccount, parseMessage, modelContext, LIMITS, MODEL } from "../lib/chat/policy.mjs";
import { sendMessage } from "../lib/chat/handler.mjs";
import { geminiText } from "../lib/chat/provider.mjs";

const account = { id: "verified-owner", email: "owner@example.test", emailVerified: true };
const config = { allowed: [account.email], key: "fake-key", model: MODEL };
const body = () => ({ conversationId: randomUUID(), requestId: randomUUID(), text: "Olá" });
const request = (data, origin = "https://jarvis-bob.vercel.app") => new Request("https://jarvis-bob.vercel.app/api/chat", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(data) });
const env = { NODE_ENV: "production" };
test("chat fails closed for missing configuration, unverified and unlisted accounts", () => {
  assert.equal(chatConfiguration({}), null);
  assert.throws(() => requireChatAccount(null, config), e => e.status === 401);
  assert.throws(() => requireChatAccount({ ...account, emailVerified: false }, config), e => e.status === 403);
  assert.throws(() => requireChatAccount({ ...account, email: "other@example.test" }, config), e => e.status === 403);
  assert.equal(requireChatAccount(account, config), account.id);
});
test("client cannot inject owners, roles, models, oversized input or credentials", () => {
  for (const extra of [{ owner_id: "other" }, { role: "system" }, { model: "expensive" }, { text: "x".repeat(4001) }, { text: "AIza" + "x".repeat(35) }, { text: "\0" }]) {
    assert.throws(() => parseMessage({ ...body(), ...extra }));
  }
  assert.equal(parseMessage(body()).text, "Olá");
});
test("context is bounded and preserves user/model pairs from saved history", () => {
  const turns = Array.from({ length: 20 }, (_, i) => ({ user_text: "u".repeat(1000), assistant_text: String(i).repeat(1000) }));
  const contents = modelContext(turns, "new");
  assert.ok(contents.length <= LIMITS.turns * 2 + 1);
  assert.ok(contents.reduce((n, c) => n + c.parts[0].text.length, 0) <= LIMITS.context);
  assert.equal(contents.at(-1).parts[0].text, "new");
  for (let i = 0; i < contents.length - 1; i += 2) assert.deepEqual(contents.slice(i, i + 2).map(c => c.role), ["user", "model"]);
});
test("anonymous and cross-origin sends never touch storage or the provider", async () => {
  const forbidden = () => { throw new Error("must not run"); };
  await assert.rejects(sendMessage(request(body()), { account: null, config, store: { reserve: forbidden }, provider: forbidden, env }), e => e.status === 401);
  await assert.rejects(sendMessage(request(body(), "https://evil.example"), { account, config, store: { reserve: forbidden }, provider: forbidden, env }), e => e.status === 403);
});
test("stream completion is acknowledged only after persistence under the session owner", async () => {
  const calls = [];
  const store = {
    async reserve(owner) { assert.equal(owner, account.id); return { turns: [], used: 1 }; },
    async complete(owner, id, text) { calls.push({ owner, text }); },
    async fail() { assert.fail("unexpected failure"); },
  };
  async function* provider() { yield { type: "delta", text: "Olá!" }; }
  const response = await sendMessage(request(body()), { account, config, store, provider, env });
  const events = (await response.text()).trim().split("\n").map(JSON.parse);
  assert.equal(events.at(-1).type, "done");
  assert.deepEqual(calls, [{ owner: account.id, text: "Olá!" }]);
  assert.match(response.headers.get("cache-control"), /no-store/);
});
test("failed persistence never reports a completed answer and does not retry the provider", async () => {
  let calls = 0, failed = 0;
  const store = { async reserve() { return { turns: [], used: 1 }; }, async complete() { throw new Error("database offline"); }, async fail() { failed++; } };
  async function* provider() { calls++; yield { type: "delta", text: "Partial" }; }
  const response = await sendMessage(request(body()), { account, config, store, provider, env });
  const events = (await response.text()).trim().split("\n").map(JSON.parse);
  assert.equal(events.at(-1).type, "error"); assert.equal(calls, 1); assert.equal(failed, 1);
  assert.ok(!events.some(e => e.type === "done"));
});
test("idempotent completed sends replay without a provider call", async () => {
  const response = await sendMessage(request(body()), { account, config, env,
    store: { async reserve() { return { replay: { assistant_text: "Saved", model: MODEL } }; } },
    provider() { assert.fail("replay must not call model"); },
  });
  const result = await response.text(); assert.match(result, /Saved/); assert.match(result, /"replay":true/);
});
test("provider parses split UTF-8 SSE, excludes thoughts and applies economical configuration", async () => {
  const payload = 'data: {"candidates":[{"content":{"parts":[{"text":"hidden","thought":true},{"text":"Olá!"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5}}\r\n\r\n';
  const bytes = new TextEncoder().encode(payload);
  const fetcher = async (url, options) => {
    assert.ok(!url.includes("fake-key")); assert.equal(options.headers["x-goog-api-key"], "fake-key");
    const data = JSON.parse(options.body); assert.equal(data.generationConfig.maxOutputTokens, 1024);
    assert.equal(data.generationConfig.thinkingConfig.thinkingBudget, 0); assert.ok(!data.tools);
    return new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } }));
  };
  const events = [];
  for await (const event of geminiText({ ...config, contents: [], fetcher })) events.push(event);
  assert.equal(events[0].text, "Olá!"); assert.equal(events[1].usage.input, 10);
});
test("provider rejects a truncated stream and never exposes an upstream error body", async () => {
  const fetcher = async () => new Response('data: {"candidates":[{"content":{"parts":[{"text":"unfinished"}]}}]}\n');
  await assert.rejects(async () => { for await (const event of geminiText({ ...config, contents: [], fetcher })) void event; }, /incomplete_response/);
  await assert.rejects(async () => { for await (const event of geminiText({ ...config, contents: [], fetcher: async () => new Response("private upstream body", { status: 500 }) })) void event; }, /provider_unavailable/);
});
