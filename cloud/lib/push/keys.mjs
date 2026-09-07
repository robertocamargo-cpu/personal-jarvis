// VAPID keys for Web Push Notifications (RFC 8292)

export const DEFAULT_VAPID_PUBLIC_KEY =
  "BL80FfHk-Z2DlxplrTHdsnexi6rqyMoYXwYjYxUvFY4yS7kZ0wk0fkpywc2u1gNEDd1qoolP7xKuB8yr9UE9CnU";
export const DEFAULT_VAPID_PRIVATE_KEY =
  "Sy9Ualm7kfsfKJ2maW9RAREzcIuMek_hVfilXOtB-vk";
export const DEFAULT_VAPID_SUBJECT = "mailto:roberto.camargo@gmail.com";

export function getVapidKeys(env = process.env) {
  return {
    publicKey: env.VAPID_PUBLIC_KEY?.trim() || DEFAULT_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY?.trim() || DEFAULT_VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT,
  };
}
