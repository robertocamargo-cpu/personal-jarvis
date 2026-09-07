import test from "node:test";
import assert from "node:assert/strict";
import { MacChatStore } from "../lib/mac_chat/store.mjs";

test("mac_chat: MacChatStore operations with mock pool", async () => {
  const queries = [];
  const mockPool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("INSERT INTO cloud_mac_messages_v1")) {
        return {
          rows: [
            {
              id: "msg-1",
              device_id: params[1],
              conversation_id: params[2],
              request_id: params[3],
              user_text: params[4],
              status: "pending",
              created_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes("SELECT device_id FROM cloud_device_pairings_v1")) {
        return {
          rows: [{ device_id: "mac-studio-01" }],
        };
      }
      if (sql.includes("UPDATE cloud_mac_messages_v1") && sql.includes("SET status = 'processing'")) {
        return {
          rows: [
            {
              id: "msg-1",
              conversation_id: "conv-1",
              request_id: "req-1",
              user_text: "Qual é a temperatura do Mac?",
              created_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes("UPDATE cloud_mac_messages_v1") && sql.includes("SET assistant_text = $1")) {
        return {
          rows: [
            {
              id: "msg-1",
              request_id: "req-1",
              status: params[1],
              assistant_text: params[0],
              completed_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes("SELECT id, device_id, conversation_id")) {
        return {
          rows: [
            {
              id: "msg-1",
              device_id: "mac-studio-01",
              conversation_id: "conv-1",
              request_id: "req-1",
              user_text: "Olá",
              assistant_text: "Olá! Tudo bem?",
              status: "complete",
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    },
  };

  const store = new MacChatStore(mockPool);

  const enqueued = await store.enqueueMessage({
    ownerId: "owner-1",
    conversationId: "conv-1",
    requestId: "req-1",
    userText: "Olá Mac",
  });

  assert.equal(enqueued.id, "msg-1");
  assert.equal(enqueued.device_id, "mac-studio-01");
  assert.equal(enqueued.status, "pending");

  const polled = await store.pollPendingMessages("mac-studio-01");
  assert.equal(polled.length, 1);
  assert.equal(polled[0].request_id, "req-1");

  const replied = await store.replyMessage({
    deviceId: "mac-studio-01",
    requestId: "req-1",
    assistantText: "Olá do Mac!",
  });
  assert.equal(replied.status, "complete");
  assert.equal(replied.assistant_text, "Olá do Mac!");

  const status = await store.getMessageStatus("owner-1", "conv-1", "req-1");
  assert.equal(status.status, "complete");
});
