/**
 * pushController.js
 *
 * Handles Web Push subscription management:
 *   POST /api/push/subscribe    — save a subscription for the current user
 *   DELETE /api/push/unsubscribe — remove a subscription
 *   GET  /api/push/vapid-public-key — return the VAPID public key to the frontend
 */
import PushSubscription from "../models/PushSubscription.js";

// GET /api/push/vapid-public-key  (public — no auth needed)
export async function getVapidPublicKey(req, res) {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
}

// POST /api/push/subscribe  (requires auth)
export async function subscribe(req, res) {
  const { subscription, role } = req.body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    res.status(400);
    throw new Error("Invalid subscription object");
  }

  const phone = req.owner.phone;
  const userRole = role === "member" ? "member" : "owner";

  // Upsert — update if endpoint already exists, insert if new
  await PushSubscription.findOneAndUpdate(
    { phone, "subscription.endpoint": subscription.endpoint },
    { phone, role: userRole, subscription },
    { upsert: true, new: true }
  );

  res.json({ message: "Subscribed successfully" });
}

// DELETE /api/push/unsubscribe  (requires auth)
export async function unsubscribe(req, res) {
  const { endpoint } = req.body;

  if (!endpoint) {
    res.status(400);
    throw new Error("endpoint is required");
  }

  await PushSubscription.deleteMany({
    phone: req.owner.phone,
    "subscription.endpoint": endpoint,
  });

  res.json({ message: "Unsubscribed successfully" });
}
