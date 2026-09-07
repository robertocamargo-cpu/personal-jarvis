import test from "node:test";
import assert from "node:assert/strict";
import { getVapidKeys, DEFAULT_VAPID_PUBLIC_KEY } from "../lib/push/keys.mjs";
import { PushStore } from "../lib/push/store.mjs";

test("push: getVapidKeys returns valid keys", () => {
  const keys = getVapidKeys();
  assert.equal(typeof keys.publicKey, "string");
  assert.equal(typeof keys.privateKey, "string");
  assert.equal(keys.publicKey, DEFAULT_VAPID_PUBLIC_KEY);
  assert.ok(keys.subject.startsWith("mailto:"));
});

test("push: PushStore operations with mock pool", async () => {
  const queries = [];
  const mockPool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("INSERT INTO cloud_push_subscriptions_v1")) {
        return {
          rows: [
            {
              id: "sub-1",
              endpoint: params[1],
              created_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes("SELECT endpoint, p256dh, auth FROM cloud_push_subscriptions_v1")) {
        return {
          rows: [
            {
              endpoint: "https://push.example.com/sub/1",
              p256dh: "key-1",
              auth: "auth-1",
            },
          ],
        };
      }
      if (sql.includes("DELETE FROM cloud_push_subscriptions_v1")) {
        return { rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };

  const store = new PushStore(mockPool);

  const saved = await store.saveSubscription(
    "owner-1",
    {
      endpoint: "https://push.example.com/sub/1",
      keys: { p256dh: "key-1", auth: "auth-1" },
    },
    "Safari Mobile"
  );

  assert.equal(saved.id, "sub-1");
  assert.equal(saved.endpoint, "https://push.example.com/sub/1");

  const list = await store.listSubscriptions("owner-1");
  assert.equal(list.length, 1);
  assert.equal(list[0].endpoint, "https://push.example.com/sub/1");

  const removed = await store.removeSubscription("https://push.example.com/sub/1");
  assert.equal(removed, true);
});
