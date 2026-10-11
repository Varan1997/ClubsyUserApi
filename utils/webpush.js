/**
 * webpush.js
 *
 * Utility to send Web Push notifications to all subscribed devices
 * for a given phone number + role.
 *
 * Uses the VAPID keys from .env to authenticate with push services.
 */
import webpush from "web-push";
import PushSubscription from "../models/PushSubscription.js";

// Configure VAPID once at module load
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:admin@clubsy.app",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a push notification to all devices subscribed for a phone+role.
 *
 * @param {string} phone        - Recipient phone number
 * @param {string} role         - "owner" or "member"
 * @param {object} payload      - { title, body, icon?, url? }
 */
export async function sendPushToPhone(phone, role, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("[webpush] VAPID keys not set — skipping push notification");
    return;
  }

  const subs = await PushSubscription.find({ phone, role }).lean();
  if (!subs.length) return;

  const message = JSON.stringify({
    title: payload.title,
    body:  payload.body  || "",
    icon:  payload.icon  || "/icons/icon-192.png",
    url:   payload.url   || "/",
  });

  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s.subscription, message))
  );

  // Remove subscriptions that are no longer valid (410 Gone / 404 Not Found)
  const expiredEndpoints = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const status = r.reason?.statusCode;
      if (status === 410 || status === 404) {
        expiredEndpoints.push(subs[i].subscription.endpoint);
      } else {
        console.error(`[webpush] Failed to send to ${phone}:`, r.reason?.message);
      }
    }
  });

  if (expiredEndpoints.length) {
    await PushSubscription.deleteMany({
      phone,
      "subscription.endpoint": { $in: expiredEndpoints },
    });
    console.log(`[webpush] Removed ${expiredEndpoints.length} expired subscription(s) for ${phone}`);
  }
}
