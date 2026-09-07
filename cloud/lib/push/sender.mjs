import webpush from "web-push";
import { getVapidKeys } from "./keys.mjs";

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return;
  const { publicKey, privateKey, subject } = getVapidKeys();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function sendPushNotification(subscription, payload) {
  ensureVapidConfig();

  const subObj = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);

  try {
    return await webpush.sendNotification(subObj, payloadString, {
      TTL: 300, // 5 minutes
      urgency: "high",
    });
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription has expired or is invalid
      return { expired: true, endpoint: subscription.endpoint };
    }
    console.error("Failed to deliver web push:", error?.message || error);
    return { error: true };
  }
}

export async function broadcastPushToOwner(pushStore, ownerId, payload) {
  if (!ownerId) return { delivered: 0, removed: 0 };
  const subs = await pushStore.listSubscriptions(ownerId);
  if (!subs || subs.length === 0) return { delivered: 0, removed: 0 };

  let delivered = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      const res = await sendPushNotification(sub, payload);
      if (res && res.expired) {
        await pushStore.removeSubscription(sub.endpoint).catch(() => {});
        removed++;
      } else if (!res?.error) {
        delivered++;
      }
    })
  );

  return { delivered, removed };
}
